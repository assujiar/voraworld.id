import { cancelSigningRequestAction, fulfilPartyAction, requestSigningAction, trackPartiesAction } from '@/actions/signing'
import { fmt } from '@/components/admin/AdminPage'
import { SIGNING_PURPOSES, PURPOSE_LABELS, signingEligibility, trustPolicy } from '@/content/trust-policy'
import { METHOD_LABEL } from '@/content/verify-labels'
import { currentUser } from '@/server/auth/guard'
import { many, rpc } from '@/server/data'
import { artifactsOf } from '@/server/trust/artifacts'

/** What the trust system holds about a general document, and how to ask for a signature on it. Read-only except for the forms, each of which is an administrator action with its own checks. */
export async function DocumentTrustPanel({ id, documentKind, status, number }: { id: number; documentKind: string; status: string; number: string }) {
  const me = await currentUser()
  const policy = trustPolicy('document', documentKind)
  const eligible = signingEligibility(policy)
  const [artifacts, requests, events, parties, profiles, chain] = await Promise.all([
    artifactsOf('document', id), many('signing_requests', (q) => q.eq('kind', 'document').eq('document_id', id).order('id', { ascending: false })),
    many('signing_events', (q) => q.eq('kind', 'document').eq('document_id', id).order('id'), 'ref,purpose,signer_name,signer_position,signed_at,signed_artifact_id'),
    many('document_parties', (q) => q.eq('kind', 'document').eq('document_id', id).order('id')), many('signer_profiles', (q) => q.eq('status', 'active').order('display_name')),
    rpc<{ ok: boolean; events: number }>('trust_verify_evidence', { p_kind: 'document', p_document: id }),
  ])
  const here = `/admin/documents/${id}`
  const mine = profiles.find((p) => p.userId === me?.id)
  const stateOf = (s: string) => ({ issued: 'issued file', signed: 'signed file' }[s] ?? s)
  return (
    <div className="admin-panel">
      <h4>Verification and signing</h4>
      <p className="mini muted">Policy for this kind of document: {policy.signing === 'none' ? 'issued and verified, not signed by a person' : policy.signing === 'party_based' ? 'each party signs for itself' : 'a person may sign it'} · {eligible.ok ? (eligible.needsLegalReview ? 'electronic signing in VORA needs a recorded legal review first' : 'electronic signing in VORA is allowed (non-certified)') : eligible.message.en}</p>
      {artifacts.length ? (
        <table><thead><tr><th>Version</th><th>File</th><th>SHA-256</th><th>Recorded</th></tr></thead><tbody>
          {artifacts.map((a) => <tr key={a.id}><td>v{a.version}</td><td><a href={`/admin/documents/${id}/artifact/${a.version}`} target="_blank" rel="noopener">{stateOf(a.role)} ↗</a></td><td className="mini" style={{ overflowWrap: 'anywhere' }}>{a.sha256}</td><td>{fmt(a.createdAt)}</td></tr>)}
        </tbody></table>
      ) : <p className="mini">No archived file: {status === 'issued' ? 'this document was issued before the archive existed, or its PDF has not been made yet (open it once). Documents issued before the archive are not given one afterwards.' : 'it is archived when it is issued.'}</p>}
      {chain.events ? <p className="mini">{chain.ok ? `Evidence history intact (${chain.events} events).` : 'Evidence history failed its check: do not rely on this document and tell the administrator.'}</p> : null}
      {events.length ? <div><strong className="mini">Signing evidence</strong>{events.map((e) => <p key={e.ref as string} className="mini">{e.signerName as string}, {e.signerPosition as string} · {PURPOSE_LABELS.en[e.purpose as keyof typeof PURPOSE_LABELS.en]} · {fmt(e.signedAt as Date)} · {e.ref as string}</p>)}</div> : null}
      {requests.filter((r) => r.status === 'pending').map((r) => (
        <p key={r.id as number} className="mini">Signing requested {r.ref as string} ({r.purpose as string}) for {profiles.find((p) => p.id === r.signerProfileId)?.displayName as string} · expires {fmt(r.expiresAt as Date)}
          {mine && r.signerProfileId === mine.id ? <> · <a className="button" href={`/admin/signing/${r.id}`}>Sign now</a></> : null}
          <form action={cancelSigningRequestAction} style={{ display: 'inline', marginLeft: 8 }}><input type="hidden" name="request_id" value={r.id as number} /><input type="hidden" name="back" value={here} /><button className="button-outline">Cancel</button></form></p>
      ))}
      {parties.length ? (
        <div>
          <strong className="mini">Parties</strong>
          <ul className="mini">{parties.map((p) => (
            <li key={p.id as number}>{p.name as string} ({p.role as string}){p.required ? '' : ' · optional'} - {p.method ? `${METHOD_LABEL[p.method as string]?.en ?? p.method}${p.evidenceNote ? `: ${p.evidenceNote}` : ''}` : 'not yet signed'}
              {!p.method ? (
                <form action={fulfilPartyAction} style={{ display: 'inline-flex', gap: 6, marginLeft: 8, flexWrap: 'wrap' }}>
                  <input type="hidden" name="party_id" value={p.id as number} />
                  <select name="method" aria-label="How the party signed"><option value="external_pdf_uploaded">Signed PDF received (not validated)</option><option value="wet_ink_uploaded">Wet-ink document received</option><option value="manually_validated">Validated by VORA by hand</option><option value="external_certified_verified">Certified signature checked elsewhere</option></select>
                  <input name="note" placeholder="Evidence seen" required minLength={5} /> <button className="button-outline">Record</button>
                </form>
              ) : null}
            </li>))}</ul>
        </div>
      ) : policy.multiParty ? <form action={trackPartiesAction}><input type="hidden" name="document_id" value={id} /><button className="button-outline">Track the parties of this agreement</button></form> : null}
      {status === 'issued' && eligible.ok && artifacts.length ? (
        <form action={requestSigningAction} style={{ marginTop: 10 }}>
          <input type="hidden" name="kind" value="document" /><input type="hidden" name="document_id" value={id} /><input type="hidden" name="back" value={here} />
          <strong className="mini">Ask for a signature on {number}</strong><br />
          <select name="signer_profile_id" required aria-label="Signer"><option value="">Signer...</option>{profiles.map((p) => <option key={p.id as number} value={p.id as number}>{p.displayName as string}, {p.position as string}</option>)}</select>{' '}
          <select name="purpose" aria-label="Purpose">{SIGNING_PURPOSES.map((s) => <option key={s} value={s}>{PURPOSE_LABELS.en[s]}</option>)}</select>{' '}
          {parties.length ? <select name="party_role" aria-label="Party">{parties.map((p) => <option key={p.id as number} value={p.role as string}>{p.name as string}</option>)}</select> : null}
          {eligible.needsLegalReview ? <><br /><textarea name="legal_review_note" rows={2} placeholder="Legal review: who reviewed this document and what was decided (required for this kind of document)" required minLength={10} style={{ width: '100%', maxWidth: 520 }} /></> : null}
          <br /><button className="button">Request signature</button>
          <p className="mini muted">The signer must hold current authority for this kind of document and signs from their own account with their own passkey. Nobody can sign on their behalf.</p>
        </form>
      ) : null}
    </div>
  )
}
