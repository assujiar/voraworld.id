import { cancelSigningRequestAction, createSignerProfileAction, grantAuthorityAction, removeSignerProfileAction, revokeAuthorityAction, revokePasskeyAction } from '@/actions/signing'
import { AdminPage, fmt, type Notices } from '@/components/admin/AdminPage'
import { PasskeyRegister } from '@/components/admin/PasskeyRegister'
import { AsyncButton } from '@/components/feedback/AsyncButton'
import { PendingForm } from '@/components/feedback/scope'
import { DOCUMENT_TYPES } from '@/content/document-types'
import { currentUser } from '@/server/auth/guard'
import { many } from '@/server/data'

const SCOPES = [...new Set(DOCUMENT_TYPES.map((t) => t.family))]

export default async function Signers({ searchParams }: { searchParams: Promise<Notices> }) {
  const me = await currentUser()
  const [profiles, users, authorities, passkeys, open] = await Promise.all([
    many('signer_profiles', (q) => q.order('id')), many('users', (q) => q.eq('active', true).order('email'), 'id,email,auth_user_id'),
    many('signer_authorities', (q) => q.order('id')), many('signer_credentials', (q) => q.is('revoked_at', null).order('id'), 'id,profile_id,label,device_type,created_at,last_used_at'),
    many('signing_requests', (q) => q.eq('status', 'pending').gt('expires_at', new Date().toISOString()).order('id', { ascending: false })),
  ])
  const removed = profiles.filter((p) => p.status === 'removed')
  const live = profiles.filter((p) => p.status !== 'removed')
  const mine = live.find((p) => p.userId === me?.id)
  const withProfile = new Set(live.map((p) => p.userId))
  return (
    <AdminPage heading="Signers" sp={await searchParams}>
      <div className="admin-panel">
        <p className="note">A signature is made by a person, in their own account, with a passkey of their own, after confirming one exact file. Here an administrator sets up who may sign (the name and position printed come from the profile, never from whoever prepares a document) and another administrator grants the authority. It is a non-certified electronic signature; documents that need a certificate-backed signature are not signed here.</p>
      </div>
      {mine ? (
        <div className="admin-panel">
          <h4>Your signing</h4>
          <p>{mine.displayName as string}, {mine.position as string} · {passkeys.filter((k) => k.profileId === mine.id).length} passkey(s)</p>
          <PasskeyRegister />
          {open.filter((r) => r.signerProfileId === mine.id).map((r) => <p key={r.id as number}><a className="button" href={`/admin/signing/${r.id}`}>Sign {r.ref as string}</a> <span className="mini muted">expires {fmt(r.expiresAt as Date)}</span></p>)}
        </div>
      ) : null}
      <div className="admin-panel">
        <h4>Signer profiles</h4>
        <table><thead><tr><th>Name and position</th><th>Account</th><th>State</th><th>Authority</th><th>Passkeys</th></tr></thead><tbody>
          {live.map((p) => {
            const mineAuth = authorities.filter((a) => a.profileId === p.id)
            return (
              <tr key={p.id as number}>
                <td>{p.displayName as string}<br /><small className="muted">{p.position as string}</small>
                  <PendingForm action={removeSignerProfileAction} className="mini" style={{ marginTop: 8 }}>
                    <input type="hidden" name="profile_id" value={p.id as number} />
                    <input name="reason" placeholder="Reason for removing" required minLength={5} maxLength={300} aria-label={`Reason for removing ${p.displayName as string}`} style={{ width: '100%', maxWidth: 220 }} />{' '}
                    <AsyncButton className="button-outline" busy="Menghapus profil…" confirm={{ title: `Remove ${p.displayName as string}?`, body: 'Their authority ends, their passkeys are revoked and what waits for their signature is cancelled. What they signed stays on record. They can be given a profile again later.', action: 'Remove', danger: true }}>Remove signer</AsyncButton>
                  </PendingForm>
                </td>
                <td>{users.find((u) => u.id === p.userId)?.email as string}</td>
                <td>{p.status as string}</td>
                <td>
                  {mineAuth.map((a) => (
                    <div key={a.id as number} className="mini">
                      {(a.scope as string[]).join(', ')} · granted {fmt(a.grantedAt as Date)}{a.validUntil ? ` · until ${fmt(a.validUntil as Date)}` : ''}{a.soleAdminGrant ? ' · sole administrator' : ''}
                      {a.revokedAt ? <strong> · ended {fmt(a.revokedAt as Date)}: {a.revokeReason as string}</strong> : (
                        <form action={revokeAuthorityAction} style={{ display: 'inline' }}><input type="hidden" name="authority_id" value={a.id as number} /><input name="reason" placeholder="Reason" required minLength={5} style={{ width: 140 }} /> <button className="button-outline">End</button></form>
                      )}
                    </div>
                  ))}
                  <form action={grantAuthorityAction} className="mini" style={{ marginTop: 6 }}>
                    <input type="hidden" name="profile_id" value={p.id as number} />
                    {SCOPES.map((s) => <label key={s} style={{ marginRight: 8, fontWeight: 400 }}><input type="checkbox" name="scope" value={s} style={{ width: 'auto', minHeight: 0 }} /> {s}</label>)}
                    <label style={{ marginRight: 8, fontWeight: 400 }}><input type="checkbox" name="scope" value="*" style={{ width: 'auto', minHeight: 0 }} /> all</label><br />
                    <input type="date" name="valid_until" aria-label="Until" /> <input name="note" placeholder="Basis (for example the board decision)" style={{ width: 220 }} /> <button className="button-outline">Grant authority</button>
                  </form>
                </td>
                <td>{passkeys.filter((k) => k.profileId === p.id).length}{me?.id === p.userId ? passkeys.filter((k) => k.profileId === p.id).map((k) => (
                  <form key={k.id as number} action={revokePasskeyAction} style={{ display: 'inline' }}><input type="hidden" name="credential_id" value={k.id as number} /> <button className="button-outline" title="Remove this passkey">× {(k.label as string) || (k.deviceType as string)}</button></form>
                )) : null}</td>
              </tr>
            )
          })}
        </tbody></table>
        {removed.length ? (
          <details style={{ margin: '14px 0' }}>
            <summary className="mini" style={{ cursor: 'pointer' }}>Removed signers ({removed.length})</summary>
            <ul className="mini">{removed.map((p) => <li key={p.id as number}>{p.displayName as string}, {p.position as string} · {users.find((u) => u.id === p.userId)?.email as string} · removed {fmt(p.updatedAt as Date)}</li>)}</ul>
            <p className="mini muted">Their signatures stay on record. Creating a profile for the same account again reuses it, with no authority until it is granted again.</p>
          </details>
        ) : null}
        <h4>New signer profile</h4>
        <form action={createSignerProfileAction}>
          <select name="user_id" required>{users.filter((u) => u.authUserId && !withProfile.has(u.id)).map((u) => <option key={u.id as number} value={u.id as number}>{u.email as string}</option>)}</select>{' '}
          <input name="display_name" placeholder="Full name as it appears on documents" required minLength={3} style={{ width: 260 }} />{' '}
          <input name="position" placeholder="Position" required style={{ width: 200 }} />{' '}
          <button className="button">Create profile</button>
        </form>
      </div>
      {open.length ? (
        <div className="admin-panel"><h4>Open signing requests</h4>
          <table><thead><tr><th>Reference</th><th>Document</th><th>Purpose</th><th>Expires</th><th /></tr></thead><tbody>
            {open.map((r) => <tr key={r.id as number}><td>{r.ref as string}</td><td>{r.kind as string} #{r.documentId as number}</td><td>{r.purpose as string}</td><td>{fmt(r.expiresAt as Date)}</td>
              <td><form action={cancelSigningRequestAction}><input type="hidden" name="request_id" value={r.id as number} /><input type="hidden" name="back" value="/admin/signers" /><button className="button-outline">Cancel</button></form></td></tr>)}
          </tbody></table>
        </div>
      ) : null}
    </AdminPage>
  )
}
