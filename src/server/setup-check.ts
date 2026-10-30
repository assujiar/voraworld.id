import { count, many, one } from './data'
import { appEnv, isProd, publicBaseUrl, supabaseSecretKey, supabaseUrl } from './env'
import { encryptionKeyUsable } from './mail/secret'

export interface SetupCheck {
  id: string
  label: string
  ok: boolean
  /** What to do when it is not ok. Never contains a configured value. */
  hint: string
  href?: string
  /** `launch` items matter before real documents are issued; `info` items are recommendations. */
  level: 'launch' | 'info'
}

/**
 * The owner configures Vercel, Supabase and email by hand. This turns what the running server can see into a checklist
 * for the dashboard. It reads presence and shape only: no secret, key, password or URL is ever put in the result.
 */
export async function setupChecklist(): Promise<SetupCheck[]> {
  const [mail, rules, banks, settingRows, admins] = await Promise.all([
    one('mail_config', (q) => q.eq('id', 1), 'enabled,host'),
    count('email_rules', (q) => q.eq('enabled', true)),
    count('bank_accounts', (q) => q.eq('active', true)),
    many('settings', (q) => q.in('key', ['privacy', 'terms', 'email', 'address']), 'key,value'),
    count('users', (q) => q.eq('role', 'admin').eq('active', true).not('auth_user_id', 'is', null)),
  ])
  const settings = Object.fromEntries(settingRows.map((r) => [r.key as string, String(r.value ?? '')]))
  const stripped = (v: string) => v.replace(/<[^>]*>/g, '').trim()
  const checks: SetupCheck[] = [
    { id: 'mode', level: 'launch', ok: isProd(), label: 'Running in production mode', hint: `This server runs in "${appEnv()}" mode. Set APP_ENV=production (required on Vercel).` },
    { id: 'https', level: 'launch', ok: publicBaseUrl().startsWith('https://'), label: 'Public address is https', hint: 'Set PUBLIC_BASE_URL to the final https domain before issuing any document: it is printed into every QR code and email.' },
    { id: 'storage', level: 'launch', ok: Boolean(supabaseUrl() && supabaseSecretKey()), label: 'Supabase Storage is connected', hint: 'Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY. Image uploads, stamped receipts and signed quotations need them.' },
    { id: 'encryption', level: 'launch', ok: encryptionKeyUsable(), label: 'Email encryption key is set', hint: 'Set MAIL_ENCRYPTION_KEY to 32 random bytes in base64 (openssl rand -base64 32). The SMTP password cannot be saved without it.' },
    { id: 'cron', level: 'info', ok: (process.env.CRON_SECRET ?? '').length >= 32, label: 'Scheduled email retry is protected', hint: 'Set CRON_SECRET to 32+ random characters. Without it the daily retry of failed emails does nothing.' },
    { id: 'smtp', level: 'launch', ok: Boolean(mail?.enabled && mail.host), label: 'SMTP email is configured and on', hint: 'Enter your SMTP details and send a test email.', href: '/admin/mail' },
    { id: 'rules', level: 'launch', ok: rules > 0, label: 'At least one email notification is switched on', hint: 'Every notification starts off. Switch on the ones you want, for example the invoice and receipt emails.', href: '/admin/mail' },
    { id: 'bank', level: 'launch', ok: banks > 0, label: 'A company bank account exists', hint: 'Add the account customers pay into; it is printed on invoices.', href: '/admin/bank-accounts' },
    { id: 'company', level: 'launch', ok: Boolean(settings.email && settings.address), label: 'Company contact details are filled in', hint: 'The public email and address appear on the website and on every document. The legal name defaults to PT Satu Arah International.', href: '/admin/settings' },
    { id: 'legal', level: 'launch', ok: Boolean(stripped(settings.privacy ?? '') && stripped(settings.terms ?? '')), label: 'Privacy and Terms texts are published', hint: 'Paste the lawyer-approved texts. Until then those pages are empty and hidden from search engines.', href: '/admin/settings' },
    { id: 'admin', level: 'info', ok: admins > 0, label: 'An administrator account exists', hint: 'In the Supabase dashboard add the user (Authentication, Users), then run in the SQL Editor: select public.promote_admin(\'their@email\');' },
  ]
  return checks
}
