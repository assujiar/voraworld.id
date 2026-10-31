import nodemailer from 'nodemailer'
import type { MailConfigRow } from '../schema'
import { emailAddress } from './address'
import { decryptSecret } from './secret'

export interface Attachment { filename: string; content: Uint8Array }
/** One attachment, or an array when a message carries several (the invoice and its pre-payment receipt). */
export type Sender = (conf: MailConfigRow, to: string, subject: string, html: string, attachment?: Attachment | Attachment[]) => Promise<void>

/** The plain-text alternative. A link keeps its address, because a reader of the text part can not click what has been stripped away. */
export const stripTags = (html: string) => html
  .replace(/<a\b[^>]*\bhref="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, label: string) => { const text = label.replace(/<[^>]+>/g, '').trim(); return text && text !== href ? `${text} (${href})` : href })
  .replace(/<\/(p|div|li|h\d)>|<br\s*\/?>/gi, '\n')
  .replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').replace(/\n{3,}/g, '\n\n').trim()

const smtpSender: Sender = async (conf, to, subject, html, attachment) => {
  if (!conf.enabled) throw new Error('SMTP disabled')
  const transporter = nodemailer.createTransport({
    host: conf.host ?? '',
    port: conf.port ?? 587,
    secure: conf.security === 'ssl',
    requireTLS: conf.security === 'starttls',
    auth: conf.username ? { user: conf.username, pass: decryptSecret(conf.encryptedPassword ?? '') } : undefined,
    connectionTimeout: 12_000,
    greetingTimeout: 12_000,
    socketTimeout: 20_000,
  })
  try {
    await transporter.sendMail({
      from: { name: conf.fromName ?? '', address: conf.fromEmail ?? '' },
      to: emailAddress(to),
      replyTo: conf.replyTo ?? undefined,
      subject,
      text: stripTags(html),
      html,
      attachments: (Array.isArray(attachment) ? attachment : attachment ? [attachment] : []).map((a) => ({ filename: a.filename, content: Buffer.from(a.content), contentType: 'application/pdf' })),
    })
  } finally {
    transporter.close()
  }
}

let sender: Sender = smtpSender

/** The real SMTP socket is the only thing tests replace; queueing, rendering and retries run for real. */
export function setSender(next: Sender | null): void {
  sender = next ?? smtpSender
}
export const send: Sender = (...args) => sender(...args)
