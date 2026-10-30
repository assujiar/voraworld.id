import { forgotPassword } from '@/actions/auth'

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams
  return (
    <main className="wrap" style={{ maxWidth: 490, paddingTop: '10vh' }}>
      <a href="/en"><img src="/static/assets/vora-primary.svg" width={160} alt="VORA" /></a>
      <div className="form-panel" style={{ marginTop: 30 }}>
        <span className="eyebrow">Secure administration</span>
        <h1 style={{ fontSize: '2.3rem' }}>Reset your password</h1>
        {sp.error ? <div className="alert" role="alert">{sp.error}</div> : null}
        <form action={forgotPassword}>
          <div className="field"><label>Email</label><input type="email" name="email" autoComplete="username" required /></div>
          <button className="button" style={{ width: '100%' }}>Send reset link</button>
        </form>
        <p className="muted mini" style={{ marginTop: 20 }}><a href="/admin/login">Back to sign in</a></p>
      </div>
    </main>
  )
}
