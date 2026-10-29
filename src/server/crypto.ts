/**
 * Small WebCrypto helpers shared by server code and Next middleware (the edge runtime has no node:crypto).
 */
const enc = new TextEncoder()

export function b64url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function fromB64url(s: string): Uint8Array {
  const pad = '='.repeat((4 - (s.length % 4)) % 4)
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad)
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

export function randomToken(bytes = 24): string {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)))
}

/** Constant-time string comparison (length is not secret here). */
export function safeEqual(a: string, b: string): boolean {
  const x = enc.encode(a)
  const y = enc.encode(b)
  let diff = x.length ^ y.length
  const len = Math.max(x.length, y.length)
  for (let i = 0; i < len; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0)
  return diff === 0
}

async function hmacKey(secret: string, salt: string) {
  return crypto.subtle.importKey('raw', enc.encode(`${secret}:${salt}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
}

async function mac(secret: string, salt: string, data: string): Promise<string> {
  return b64url(new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(secret, salt), enc.encode(data))))
}

export async function sha256Hex(data: string | Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', typeof data === 'string' ? enc.encode(data) : (data as BufferSource))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** `<base64url(json)>.<mac>`; the payload carries its own issue time. */
export async function signToken(payload: Record<string, unknown>, secret: string, salt: string): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000) })))
  return `${body}.${await mac(secret, salt, body)}`
}

export async function verifyToken<T extends Record<string, unknown>>(token: string | undefined | null, secret: string, salt: string, maxAgeSeconds: number): Promise<(T & { iat: number }) | null> {
  if (!token || token.length > 2048) return null
  const dot = token.indexOf('.')
  if (dot < 1) return null
  const body = token.slice(0, dot)
  if (!safeEqual(token.slice(dot + 1), await mac(secret, salt, body))) return null
  try {
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(body))) as T & { iat: number }
    const age = Math.floor(Date.now() / 1000) - payload.iat
    return Number.isFinite(age) && age >= -60 && age <= maxAgeSeconds ? payload : null
  } catch {
    return null
  }
}
