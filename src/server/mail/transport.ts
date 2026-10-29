import nodemailer from 'nodemailer'
import type { MailConfigRow } from '../schema'
import { emailAddress } from './address'
import { decryptSecret } from './secret'

export interface Attachment { filename: string; content: Uint8Array }
export type Sender = (conf: MailConfigRow, to: string, subject: string, html: string, attachment?: Attachment) => Promise<void>

const stripTags = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

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
      attachments: attachment ? [{ filename: attachment.filename, content: Buffer.from(attachment.content), contentType: 'application/pdf' }] : [],
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
