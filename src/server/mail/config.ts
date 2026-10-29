import type { Db } from '../db'
import type { MailConfigRow } from '../schema'
import { emailAddress } from './address'
import { encryptSecret } from './secret'

export async function getMailConfig(db: Db): Promise<MailConfigRow | undefined> {
  const [row] = await db`select * from mail_config where id = 1`
  return row as MailConfigRow | undefined
}

export interface MailConfigInput {
  host?: string; port?: string | number; security?: string; username?: string; password?: string
  fromEmail?: string; fromName?: string; replyTo?: string; adminEmail?: string; enabled?: boolean
}

/** Validates and stores the SMTP settings. A blank password keeps the stored one. */
export async function saveMailConfig(db: Db, input: MailConfigInput): Promise<void> {
  const host = String(input.host ?? '').trim().toLowerCase()
  if (host && (!/^[a-z0-9.-]{1,253}$/.test(host) || host.includes('..'))) throw new Error('Invalid SMTP hostname')
  const port = Number(input.port || 587)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid SMTP port')
  const security = String(input.security || 'starttls')
  if (!['starttls', 'ssl'].includes(security)) throw new Error('Use STARTTLS or implicit TLS')
  const fromEmail = emailAddress(input.fromEmail || 'info@voraworld.id')
  const replyTo = emailAddress(input.replyTo || fromEmail)
  const adminEmail = emailAddress(input.adminEmail || 'info@voraworld.id')
  const existing = await getMailConfig(db)
  const password = String(input.password ?? '')
  const encrypted = password ? encryptSecret(password) : existing?.encryptedPassword ?? ''
  const username = String(input.username ?? '').slice(0, 240)
  const enabled = Boolean(input.enabled)
  if (enabled && (!host || (username && !encrypted))) throw new Error('Host and SMTP credentials must be configured before enabling mail')
  const fromName = String(input.fromName || 'VORA Freight & Logistics').slice(0, 120)
  await db`insert into mail_config (id, host, port, security, username, encrypted_password, from_email, from_name, reply_to, admin_email, enabled)
           values (1, ${host}, ${port}, ${security}, ${username}, ${encrypted}, ${fromEmail}, ${fromName}, ${replyTo}, ${adminEmail}, ${enabled})
           on conflict (id) do update set host = excluded.host, port = excluded.port, security = excluded.security, username = excluded.username,
             encrypted_password = excluded.encrypted_password, from_email = excluded.from_email, from_name = excluded.from_name,
             reply_to = excluded.reply_to, admin_email = excluded.admin_email, enabled = excluded.enabled`
}
