import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

/**
 * The SMTP password is stored AES-256-GCM encrypted. MAIL_ENCRYPTION_KEY is 32 random bytes, base64-encoded:
 *   openssl rand -base64 32
 * Back it up: without it the saved password cannot be read.
 */
function key(): Buffer {
  const raw = (process.env.MAIL_ENCRYPTION_KEY || '').trim()
  if (!raw) throw new Error('MAIL_ENCRYPTION_KEY must be configured on the server before saving SMTP credentials')
  const k = Buffer.from(raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
  if (k.length !== 32) throw new Error('MAIL_ENCRYPTION_KEY must be 32 random bytes, base64-encoded (openssl rand -base64 32)')
  return k
}

/** True when MAIL_ENCRYPTION_KEY is present and valid (never reveals the key). */
export function encryptionKeyUsable(): boolean {
  try { key(); return true } catch { return false }
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return 'v1:' + Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64')
}

export function decryptSecret(stored: string): string {
  if (!stored) return ''
  if (!stored.startsWith('v1:')) throw new Error('Stored SMTP password uses an unknown format; save it again in the admin')
  const buf = Buffer.from(stored.slice(3), 'base64')
  try {
    const decipher = createDecipheriv('aes-256-gcm', key(), buf.subarray(0, 12))
    decipher.setAuthTag(buf.subarray(12, 28))
    return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString('utf8')
  } catch {
    throw new Error('Stored SMTP password cannot be decrypted with the current MAIL_ENCRYPTION_KEY')
  }
}
