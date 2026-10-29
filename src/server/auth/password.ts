import { pbkdf2, randomBytes, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const pbkdf2Async = promisify(pbkdf2)
const ITERATIONS = 310_000

/** `pbkdf2_sha256$<iterations>$<salt hex>$<digest hex>`, the same format the previous Python version stored. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(32)
  const digest = await pbkdf2Async(password, salt, ITERATIONS, 32, 'sha256')
  return `pbkdf2_sha256$${ITERATIONS}$${salt.toString('hex')}$${digest.toString('hex')}`
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  try {
    const [scheme, iterations, salt, expected] = encoded.split('$')
    const n = Number(iterations)
    if (scheme !== 'pbkdf2_sha256' || !Number.isInteger(n) || n < 1 || n > 5_000_000 || !salt || !expected) return false
    const want = Buffer.from(expected, 'hex')
    const got = await pbkdf2Async(password, Buffer.from(salt, 'hex'), n, want.length, 'sha256')
    return want.length === got.length && timingSafeEqual(want, got)
  } catch {
    return false
  }
}

/** Verified against when the account does not exist, so response time does not reveal which emails are registered. */
export const DUMMY_PASSWORD_HASH = `pbkdf2_sha256$${ITERATIONS}$${'00'.repeat(32)}$${'00'.repeat(32)}`

export const MIN_PASSWORD_LENGTH = 14
