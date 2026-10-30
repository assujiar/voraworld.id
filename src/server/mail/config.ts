import { one, upsert } from '../data'
import type { MailConfigRow } from '../schema'
import { emailAddress } from './address'
import { encryptSecret } from './secret'

export async function getMailConfig(): Promise<MailConfigRow | undefined> {
  return (await one('mail_config', (q) => q.eq('id', 1))) as MailConfigRow | undefined
}

export interface MailConfigInput {
  host?: string; port?: string | number; security?: string; username?: string; password?: string
  fromEmail?: string; fromName?: string; replyTo?: string; adminEmail?: string; enabled?: boolean
}

/** Validates and stores the SMTP settings. A blank password keeps the stored one. */
export async function saveMailConfig(input: MailConfigInput): Promise<void> {
  const host = String(input.host ?? '').trim().toLowerCase()
  if (host && (!/^[a-z0-9.-]{1,253}$/.test(host) || host.includes('..'))) throw new Error('Invalid SMTP hostname')
  const port = Number(input.port || 587)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid SMTP port')
  const security = String(input.security || 'starttls')
  if (!['starttls', 'ssl'].includes(security)) throw new Error('Use STARTTLS or implicit TLS')
  const fromEmail = emailAddress(input.fromEmail || 'info@voraworld.id')
  const replyTo = emailAddress(input.replyTo || fromEmail)
  const adminEmail = emailAddress(input.adminEmail || 'info@voraworld.id')
  const existing = await getMailConfig()
  const password = String(input.password ?? '')
  const encrypted = password ? encryptSecret(password) : existing?.encryptedPassword ?? ''
  const username = String(input.username ?? '').slice(0, 240)
  const enabled = Boolean(input.enabled)
  if (enabled && (!host || (username && !encrypted))) throw new Error('Host and SMTP credentials must be configured before enabling mail')
  const fromName = String(input.fromName || 'VORA Freight & Logistics').slice(0, 120)
  await upsert('mail_config', { id: 1, host, port, security, username, encrypted_password: encrypted, from_email: fromEmail, from_name: fromName, reply_to: replyTo, admin_email: adminEmail, enabled }, 'id')
}
