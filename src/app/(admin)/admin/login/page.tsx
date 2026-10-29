import { login } from '@/actions/auth'

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams
  return (
    <main className="wrap" style={{ maxWidth: 490, paddingTop: '10vh' }}>
      <a href="/en"><img src="/static/assets/vora-primary.svg" width={160} alt="VORA" /></a>
      <div className="form-panel" style={{ marginTop: 30 }}>
        <span className="eyebrow">Secure administration</span>
        <h2 style={{ fontSize: '2.3rem' }}>Sign in</h2>
        {sp.error ? <div className="alert" role="alert">{sp.error}</div> : null}
        <form action={login}>
          <input type="hidden" name="next" value={sp.next ?? ''} />
          <div className="field"><label>Email</label><input type="email" name="email" autoComplete="username" required /></div>
          <div className="field"><label>Password</label><input type="password" name="password" autoComplete="current-password" required /></div>
          <button className="button" style={{ width: '100%' }}>Sign in</button>
        </form>
        <p className="muted mini" style={{ marginTop: 20 }}>Access is restricted. Contact the account administrator for access.</p>
      </div>
    </main>
  )
}
