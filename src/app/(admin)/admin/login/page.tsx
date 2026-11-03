import { login } from '@/actions/auth'
import { AsyncButton } from '@/components/feedback/AsyncButton'
import { PendingForm } from '@/components/feedback/scope'
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; notice?: string }> }) {
  const sp = await searchParams
  return <main className="admin-login">
    <div className="admin-login__identity"><a href="/en"><img src="/static/assets/vora-reverse.svg" width={1780} height={384} alt="VORA home" /></a><div><p className="eyebrow">VORA / BUSINESS PORTAL</p><p className="admin-login__headline">Keep the work connected.</p><p>Content, customer records and commercial documents in one controlled workspace.</p></div><p className="mini">PT Satu Arah International</p></div>
    <div className="admin-login__form"><div className="form-panel"><span className="eyebrow">Secure administration</span><h1>Sign in to your workspace.</h1><p className="muted mini">Use your authorised Supabase account.</p>{sp.error ? <div className="alert" role="alert">{sp.error}</div> : null}{sp.notice ? <div className="alert" role="status">{sp.notice}</div> : null}<PendingForm action={login}><input type="hidden" name="next" value={sp.next ?? ''} /><div className="field"><label htmlFor="admin-email">Email</label><input id="admin-email" type="email" name="email" autoComplete="username" required /></div><div className="field"><label htmlFor="admin-password">Password</label><input id="admin-password" type="password" name="password" autoComplete="current-password" required /></div><AsyncButton className="button" style={{width:'100%'}}>Sign in</AsyncButton></PendingForm><p className="muted mini" style={{marginTop:20}}><a href="/admin/forgot-password">Reset your password</a></p><p className="muted mini">Access is restricted. Ask the account administrator if you need membership.</p></div></div>
  </main>
}
