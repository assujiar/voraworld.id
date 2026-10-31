import { uploadAndSignAction } from '@/actions/signing'
import { AdminPage, fmt, type Notices } from '@/components/admin/AdminPage'
import { PasskeyRegister } from '@/components/admin/PasskeyRegister'
import { PURPOSE_LABELS, SIGNING_PURPOSES } from '@/content/trust-policy'
import { currentUser } from '@/server/auth/guard'
import { many } from '@/server/data'

/**
 * The signer's own workspace: whether they are ready to sign (profile, authority, passkey), the documents that were asked of them, a way to sign a third party's document
 * without anybody asking, and what they signed. Anybody signed in can open it; only a person with a signer profile sees more than the explanation. Nothing here signs: signing
 * is done on the request's own page, with the person's own passkey.
 */
export default async function Signing({ searchParams }: { searchParams: Promise<Notices> }) {
  const me = await currentUser()
  const sp = await searchParams
  const mine = (await many('signer_profiles', (q) => q.eq('user_id', me?.id ?? 0)))[0]
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
  const [authorities, passkeys, requests, signed] = await Promise.all([
    many('signer_authorities', (q) => q.eq('profile_id', mine.id as number).order('id')),
    many('signer_credentials', (q) => q.eq('profile_id', mine.id as number).is('revoked_at', null), 'id,label,device_type,last_used_at'),
    many('signing_requests', (q) => q.eq('signer_profile_id', mine.id as number).eq('status', 'pending').gt('expires_at', new Date().toISOString()).order('id', { ascending: false })),
    many('signing_events', (q) => q.eq('profile_id', mine.id as number).order('id', { ascending: false }), 'ref,kind,document_id,purpose,signed_at', 100),
  ])
  const ids = [...new Set([...requests, ...signed].filter((r) => r.kind === 'document').map((r) => r.documentId as number))]
  const docs = ids.length ? await many('documents', (q) => q.in('id', ids), 'id,number') : []
  const now = Date.now()
  const active = authorities.filter((a) => !a.revokedAt && (!a.validUntil || (a.validUntil as Date).getTime() > now))
  const scopes = [...new Set(active.flatMap((a) => a.scope as string[]))]
  const ready = mine.status === 'active' && active.length > 0 && passkeys.length > 0
  const mayUpload = scopes.includes('*') || scopes.includes('seal')
  const number = (kind: string, id: number) => (kind === 'document' ? (docs.find((d) => d.id === id)?.number as string | undefined) : undefined) ?? `${kind} #${id}`
  const link = (kind: string, id: number) => (kind === 'document' ? `/admin/documents/${id}` : '/admin/signing')
  const purpose = (p: unknown) => PURPOSE_LABELS.en[p as (typeof SIGNING_PURPOSES)[number]] ?? String(p)
  return (
    <AdminPage heading="Verification & Signing" sp={sp}>
      <div className="admin-panel">
        <h4>Your signing</h4>
        <p><strong>{mine.displayName as string}</strong>, {mine.position as string}</p>
        <ul className="mini">
          <li>Profile: {mine.status === 'active' ? 'active' : String(mine.status)}</li>
          <li>Authority: {active.length ? `granted for ${scopes.includes('*') ? 'every kind of document' : scopes.join(', ')}${active.some((a) => a.validUntil) ? ' (with an end date)' : ''}` : <strong>none yet. Ask another administrator to grant it on <a href="/admin/signers">Signers</a>.</strong>}</li>
          <li>Passkey: {passkeys.length ? `${passkeys.length} registered` : <strong>none yet. Register one below: it is how you prove that you are the one signing.</strong>}</li>
        </ul>
        <p className={ready ? 'note' : 'alert'}>{ready ? 'You are ready to sign.' : 'You cannot sign until the missing item above is in place.'}</p>
        <PasskeyRegister />
      </div>
      <div className="admin-panel">
        <h4>Documents you can sign</h4>
        {requests.length ? (
          <table><thead><tr><th>Document</th><th>Purpose</th><th>Asked</th><th>Expires</th><th /></tr></thead><tbody>
            {requests.map((r) => (
              <tr key={r.id as number}>
                <td><a href={link(r.kind as string, r.documentId as number)}>{number(r.kind as string, r.documentId as number)}</a><br /><small className="muted">{r.ref as string}</small></td>
                <td>{purpose(r.purpose)}</td><td>{fmt(r.createdAt as Date)}</td><td>{fmt(r.expiresAt as Date)}</td>
                <td><a className="button" href={`/admin/signing/${r.id}`}>Open and sign</a></td>
              </tr>
            ))}
          </tbody></table>
        ) : <p className="mini muted">Nobody has asked you to sign a document. A document appears here only when somebody asked you to sign it.</p>}
      </div>
      {ready && mayUpload ? (
        <div className="admin-panel">
          <h4>Sign a third party&apos;s document</h4>
          <p className="mini muted">Upload a PDF that somebody else issued and sign it yourself: nobody has to ask you. The file is kept as it arrived, then you place your mark on the pages, confirm and sign with your passkey. The mark carries your name and position, with the document&apos;s verification link and QR code.</p>
          <form action={uploadAndSignAction}>
            <label>PDF to sign <input type="file" name="source_pdf" accept="application/pdf,.pdf" required /></label>
            <span className="mini muted">A readable PDF without a password and without a digital signature of its own.</span>
            <label>Title or kind of the document <input name="source_title" required maxLength={160} placeholder="For example: Cooperation agreement with PT Mitra" /></label>
            <label>Issued by (the other party) <input name="source_issuer" required maxLength={160} /></label>
            <label>Number of the original document (optional) <input name="source_reference" maxLength={100} /></label>
            <label>Language of the verification page <select name="language" defaultValue="id"><option value="id">Bahasa Indonesia</option><option value="en">English</option></select></label>
            <button className="button">Upload and continue to sign</button>
          </form>
        </div>
      ) : ready ? <div className="admin-panel"><p className="mini muted">To sign a third party&apos;s document yourself, another administrator must grant you authority for it (&quot;seal&quot;, or all) on <a href="/admin/signers">Signers</a>.</p></div> : null}
      <div className="admin-panel">
        <h4>What you signed</h4>
        {signed.length ? (
          <table><thead><tr><th>Document</th><th>Purpose</th><th>Signed</th><th>Reference</th></tr></thead><tbody>
            {signed.map((e) => <tr key={e.ref as string}><td><a href={link(e.kind as string, e.documentId as number)}>{number(e.kind as string, e.documentId as number)}</a></td><td>{purpose(e.purpose)}</td><td>{fmt(e.signedAt as Date)}</td><td>{e.ref as string}</td></tr>)}
          </tbody></table>
        ) : <p className="mini muted">Nothing yet.</p>}
      </div>
    </AdminPage>
  )
}
