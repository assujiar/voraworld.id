import { signNowAction } from '@/actions/signing'
import { AdminPage, fmt, type Notices } from '@/components/admin/AdminPage'
import { PasskeyRegister } from '@/components/admin/PasskeyRegister'
import { documentType } from '@/content/document-types'
import { PURPOSE_LABELS, SIGNING_PURPOSES, signingEligibility, trustPolicy } from '@/content/trust-policy'
import { currentUser } from '@/server/auth/guard'
import { many } from '@/server/data'

/**
 * The signer's own workspace: whether they are ready to sign (profile, authority, passkey), what is waiting for their signature, the documents they could ask to sign, and
 * what they have signed. Anybody signed in can open it; only a person with a signer profile sees more than the explanation. Nothing here signs: signing is done on the request's
 * own page, with the person's own passkey.
 */
export default async function Signing({ searchParams }: { searchParams: Promise<Notices> }) {
  const me = await currentUser()
  const [profiles, authorities, passkeys, requests, docs, signed] = await Promise.all([
    many('signer_profiles', (q) => q.eq('user_id', me?.id ?? 0)),
    many('signer_authorities', (q) => q.order('id')),
    many('signer_credentials', (q) => q.is('revoked_at', null), 'id,profile_id,label,device_type,last_used_at'),
    many('signing_requests', (q) => q.order('id', { ascending: false }), '*', 200),
    many('documents', (q) => q.eq('status', 'issued').order('id', { ascending: false }), 'id,number,kind,language,status', 60),
    many('signing_events', (q) => q.order('id', { ascending: false }), 'ref,profile_id,kind,document_id,purpose,signer_name,signed_at', 100),
  ])
  const mine = profiles[0]
  const sp = await searchParams
  if (!mine) {
    return (
      <AdminPage heading="Verification & Signing" sp={sp}>
        <div className="admin-panel">
          <p>You are not a signer. A signer is a person with a signer profile, authority to sign and a passkey of their own: an administrator sets that up on <a href="/admin/signers">Signers</a>.</p>
          <p className="mini muted">Every document VORA issues is verified by its QR code and link without anybody signing it.</p>
        </div>
      </AdminPage>
    )
  }
  const now = Date.now()
  const myAuthority = authorities.filter((a) => a.profileId === mine.id && !a.revokedAt && (!a.validUntil || (a.validUntil as Date).getTime() > now))
  const scopes = [...new Set(myAuthority.flatMap((a) => a.scope as string[]))]
  const myKeys = passkeys.filter((k) => k.profileId === mine.id)
  const covers = (family: string) => scopes.includes('*') || scopes.includes(family)
  const ready = mine.status === 'active' && myAuthority.length > 0 && myKeys.length > 0
  const myOpen = requests.filter((r) => r.signerProfileId === mine.id && r.status === 'pending' && (r.expiresAt as Date).getTime() > now)
  const mySigned = signed.filter((e) => e.profileId === mine.id)
  const busy = new Set(requests.filter((r) => r.status === 'pending' && (r.expiresAt as Date).getTime() > now && r.signerProfileId === mine.id).map((r) => `${r.kind}:${r.documentId}`))
  const done = new Set(mySigned.map((e) => `${e.kind}:${e.documentId}`))
  const candidates = docs.filter((d) => {
    const policy = trustPolicy('document', d.kind as string)
    return signingEligibility(policy).ok && covers(policy.family) && !busy.has(`document:${d.id}`) && !done.has(`document:${d.id}`)
  })
  const number = (kind: string, id: number) => (kind === 'document' ? (docs.find((d) => d.id === id)?.number as string | undefined) : undefined) ?? `${kind} #${id}`
  const link = (kind: string, id: number) => (kind === 'document' ? `/admin/documents/${id}` : '/admin/signing')
  return (
    <AdminPage heading="Verification & Signing" sp={sp}>
      <div className="admin-panel">
        <h4>Your signing</h4>
        <p><strong>{mine.displayName as string}</strong>, {mine.position as string}</p>
        <ul className="mini">
          <li>Profile: {mine.status === 'active' ? 'active' : String(mine.status)}</li>
          <li>Authority: {myAuthority.length ? `granted for ${scopes.includes('*') ? 'every kind of document' : scopes.join(', ')}${myAuthority.some((a) => a.validUntil) ? ' (with an end date)' : ''}` : <strong>none yet. Ask another administrator to grant it on <a href="/admin/signers">Signers</a>.</strong>}</li>
          <li>Passkey: {myKeys.length ? `${myKeys.length} registered` : <strong>none yet. Register one below: it is how you prove that you are the one signing.</strong>}</li>
        </ul>
        <p className={ready ? 'note' : 'alert'}>{ready ? 'You are ready to sign.' : 'You cannot sign until the missing item above is in place.'}</p>
        <PasskeyRegister />
      </div>
      <div className="admin-panel">
        <h4>Waiting for your signature</h4>
        {myOpen.length ? (
          <table><thead><tr><th>Document</th><th>Purpose</th><th>Requested</th><th>Expires</th><th /></tr></thead><tbody>
            {myOpen.map((r) => (
              <tr key={r.id as number}>
                <td><a href={link(r.kind as string, r.documentId as number)}>{number(r.kind as string, r.documentId as number)}</a><br /><small className="muted">{r.ref as string}</small></td>
                <td>{PURPOSE_LABELS.en[r.purpose as (typeof SIGNING_PURPOSES)[number]] ?? String(r.purpose)}</td>
                <td>{fmt(r.createdAt as Date)}</td><td>{fmt(r.expiresAt as Date)}</td>
                <td><a className="button" href={`/admin/signing/${r.id}`}>Open and sign</a></td>
              </tr>
            ))}
          </tbody></table>
        ) : <p className="mini muted">Nothing is waiting. Nothing was asked of you. You can sign any document below yourself, or from the document's own page.</p>}
      </div>
      {ready ? (
        <div className="admin-panel">
          <h4>Documents you can sign</h4>
          <p className="mini muted">Issued documents of the kinds you hold authority for. Press Sign: you go straight to the signing page and sign with your passkey. Nobody has to ask you first.</p>
          {candidates.length ? (
            <table><thead><tr><th>Document</th><th>Type</th><th /></tr></thead><tbody>
              {candidates.map((d) => {
                const policy = trustPolicy('document', d.kind as string), review = signingEligibility(policy)
                return (
                  <tr key={d.id as number}>
                    <td><a href={`/admin/documents/${d.id}`}>{d.number as string}</a></td>
                    <td>{documentType(d.kind as string)?.label.en ?? String(d.kind)}</td>
                    <td>
                      <form action={signNowAction}>
                        <input type="hidden" name="kind" value="document" /><input type="hidden" name="document_id" value={d.id as number} /><input type="hidden" name="back" value="/admin/signing" />
                        <select name="purpose" aria-label="Purpose">{SIGNING_PURPOSES.map((s) => <option key={s} value={s}>{PURPOSE_LABELS.en[s]}</option>)}</select>{' '}
                        {review.ok && review.needsLegalReview ? <><input name="legal_review_note" placeholder="Legal review: who reviewed it, what was decided" required minLength={10} style={{ width: 240 }} />{' '}</> : null}
                        <button className="button">Sign</button>
                      </form>
                    </td>
                  </tr>
                )
              })}
            </tbody></table>
          ) : <p className="mini muted">No issued document is waiting for you. Third-party documents are added under <a href="/admin/documents">Letters, Agreements &amp; Seals</a>.</p>}
        </div>
      ) : null}
      <div className="admin-panel">
        <h4>What you signed</h4>
        {mySigned.length ? (
          <table><thead><tr><th>Document</th><th>Purpose</th><th>Signed</th><th>Reference</th></tr></thead><tbody>
            {mySigned.map((e) => <tr key={e.ref as string}><td><a href={link(e.kind as string, e.documentId as number)}>{number(e.kind as string, e.documentId as number)}</a></td><td>{PURPOSE_LABELS.en[e.purpose as (typeof SIGNING_PURPOSES)[number]] ?? String(e.purpose)}</td><td>{fmt(e.signedAt as Date)}</td><td>{e.ref as string}</td></tr>)}
          </tbody></table>
        ) : <p className="mini muted">Nothing yet.</p>}
      </div>
    </AdminPage>
  )
}
