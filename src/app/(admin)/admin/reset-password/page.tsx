import { resetPassword } from '@/actions/auth'
import { MIN_PASSWORD_LENGTH } from '@/server/auth/policy'
import { requirePageUser } from '@/server/page-auth'

/** Opened from the emailed link, which has already signed the administrator in. */
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requirePageUser()
  const sp = await searchParams
  return (
    <main className="wrap" style={{ maxWidth: 490, paddingTop: '10vh' }}>
      <a href="/en"><img src="/static/assets/vora-primary.svg" width={160} alt="VORA" /></a>
      <div className="form-panel" style={{ marginTop: 30 }}>
        <span className="eyebrow">Secure administration</span>
        <h1 style={{ fontSize: '2.3rem' }}>Choose a new password</h1>
        {sp.error ? <div className="alert" role="alert">{sp.error}</div> : null}
        <form action={resetPassword}>
          <input type="hidden" name="_back" value="/admin/reset-password" />
          <div className="field"><label>New password (at least {MIN_PASSWORD_LENGTH} characters)</label><input type="password" name="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} required /></div>
          <div className="field"><label>Repeat the new password</label><input type="password" name="confirm" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} required /></div>
          <button className="button" style={{ width: '100%' }}>Change password</button>
        </form>
      </div>
    </main>
  )
}
