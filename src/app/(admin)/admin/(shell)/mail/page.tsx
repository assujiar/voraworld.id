import { dispatchMailAction, retryMailJobAction, saveMailConfigAction, saveMailTemplateAction, setMailRuleAction, testMailAction } from '@/actions/settings'
import { AdminPage, Back, type Notices } from '@/components/admin/AdminPage'
import { sql } from '@/server/db'
import { getMailConfig } from '@/server/mail/config'

export default async function Mail({ searchParams }: { searchParams: Promise<Notices> }) {
  const [conf, templates, rules, jobs] = await Promise.all([
    getMailConfig(sql),
    sql`select key, subject, html from email_templates order by key`,
    sql`select key, enabled from email_rules order by key`,
    sql`select id, event, recipient, status, attempts, error from email_jobs order by id desc limit 35`,
  ])
  const B = <Back to="/admin/mail" />
  return (
    <AdminPage heading="SMTP & Email Notifications" sp={await searchParams}>
      <div className="admin-panel">
        <h3>Custom SMTP</h3>
        <p className="note">SMTP credentials are encrypted at rest with MAIL_ENCRYPTION_KEY. Sending remains disabled until you configure and enable it. Credentials never appear in the form after saving.</p>
        <form action={saveMailConfigAction}>{B}
          <div className="admin-form-grid">
            <div className="field"><label>SMTP host</label><input name="host" defaultValue={conf?.host ?? ''} required /></div>
            <div className="field"><label>Port</label><input type="number" min={1} max={65535} name="port" defaultValue={conf?.port ?? 587} /></div>
            <div className="field"><label>Encryption</label><select name="security" defaultValue={conf?.security ?? 'starttls'}><option value="starttls">STARTTLS</option><option value="ssl">SSL/TLS</option></select></div>
            <div className="field"><label>SMTP username</label><input name="username" defaultValue={conf?.username ?? ''} /></div>
            <div className="field"><label>SMTP password (leave blank to retain saved value)</label><input name="password" type="password" autoComplete="new-password" placeholder={conf?.encryptedPassword ? 'Password securely stored' : 'Enter password'} /></div>
            <div className="field"><label>From email</label><input type="email" name="from_email" defaultValue={conf?.fromEmail ?? 'info@voraworld.id'} /></div>
            <div className="field"><label>From name</label><input name="from_name" defaultValue={conf?.fromName ?? 'VORA Freight & Logistics'} /></div>
            <div className="field"><label>Reply-to</label><input type="email" name="reply_to" defaultValue={conf?.replyTo ?? 'info@voraworld.id'} /></div>
            <div className="field"><label>Notification admin email</label><input type="email" name="admin_email" defaultValue={conf?.adminEmail ?? 'info@voraworld.id'} /></div>
            <div className="field"><label><input type="checkbox" name="enabled" value="1" defaultChecked={Boolean(conf?.enabled)} /> Enable SMTP delivery</label></div>
          </div>
          <button className="button">Save SMTP settings</button>
        </form>
      </div>
      <div className="admin-panel">
        <h3>Automatic email triggers</h3>
        <p className="mini muted">Enabling a rule sends mail after its associated database event, not when a form is merely opened. Failed delivery remains in the queue.</p>
        <table><thead><tr><th>Trigger</th><th>Current</th><th>Action</th></tr></thead><tbody>
          {rules.map((r) => (
            <tr key={r.key as string}><td>{r.key as string}</td><td>{r.enabled ? 'Enabled' : 'Disabled'}</td>
              <td><form action={setMailRuleAction}><input type="hidden" name="key" value={r.key as string} />{B}<button className="button-outline" name="enabled" value={r.enabled ? '0' : '1'}>{r.enabled ? 'Disable' : 'Enable'}</button></form></td></tr>
          ))}
        </tbody></table>
      </div>
      <div className="admin-panel">
        <h3>Email templates</h3>
        <p className="note">Available variables for cleared funds: $customer_name, $invoice_number, $payment_amount, $payment_date, $payment_reference, $invoice_status, $outstanding_amount. Use only approved HTML.</p>
        {templates.map((t) => (
          <details key={t.key as string} style={{ marginBottom: 15 }}><summary><strong>{t.key as string}</strong></summary>
            <form action={saveMailTemplateAction}><input type="hidden" name="key" value={t.key as string} />{B}
              <div className="field"><label>Email subject</label><input name="subject" defaultValue={t.subject as string} required /></div>
              <div className="field"><label>HTML template</label><textarea name="html" rows={6} defaultValue={t.html as string} /></div>
              <button className="button">Save template</button>
            </form></details>
        ))}
      </div>
      <div className="admin-panel">
        <h3>Delivery outbox</h3>
        <p className="mini muted">Queued messages are sent only if SMTP is enabled. Successfully accepted mail is marked sent; failed deliveries show the error and retry state.</p>
        <form action={dispatchMailAction}>{B}<button className="button">Process pending emails</button></form>
        <form action={testMailAction} style={{ margin: '12px 0' }}>{B}<button className="button-outline">Send test email to the administrator address</button></form>
        <table><thead><tr><th>Event</th><th>Recipient</th><th>Status</th><th>Attempts</th><th>Error</th><th></th></tr></thead><tbody>
          {jobs.map((j) => (
            <tr key={j.id as number}><td>{j.event as string}</td><td>{j.recipient as string}</td><td>{j.status as string}</td><td>{j.attempts as number}</td><td>{(j.error as string).slice(0, 100)}</td>
              <td>{['failed', 'retry'].includes(j.status as string) ? <form action={retryMailJobAction}><input type="hidden" name="record" value={j.id as number} />{B}<button className="button-outline">Retry</button></form> : null}</td></tr>
          ))}
        </tbody></table>
      </div>
    </AdminPage>
  )
}
