import { login } from '@/actions/auth'

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; notice?: string }> }) {
  const sp = await searchParams
  return (
    <main className="wrap" style={{ maxWidth: 490, paddingTop: '10vh' }}>
      <a href="/en"><img src="/static/assets/vora-primary.svg" width={160} alt="VORA" /></a>
      <div className="form-panel" style={{ marginTop: 30 }}>
        <span className="eyebrow">Secure administration</span>
        <h1 style={{ fontSize: '2.3rem' }}>Sign in</h1>
        {sp.error ? <div className="alert" role="alert">{sp.error}</div> : null}
        {sp.notice ? <div className="alert" role="status">{sp.notice}</div> : null}
        <form action={login}>
          <input type="hidden" name="next" value={sp.next ?? ''} />
          <div className="field"><label>Email</label><input type="email" name="email" autoComplete="username" required /></div>
          <div className="field"><label>Password</label><input type="password" name="password" autoComplete="current-password" required /></div>
          <button className="button" style={{ width: '100%' }}>Sign in</button>
        </form>
        <p className="muted mini" style={{ marginTop: 20 }}><a href="/admin/forgot-password">Forgot your password?</a> Access is restricted: contact the account administrator for access.</p>
      </div>
    </main>
  )
}
