import { createHash, randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { isLocale, type Locale } from '@/content'
import { rpc } from '@/server/data'
import { agentIpSalt } from '@/server/env'
import { agentReady } from './providers'

export const AGENT_COOKIE = 'vora_agent_session'
export const SESSION_LIFETIME_SECONDS = 7 * 86400
export const MAX_CHAT_MESSAGE_LENGTH = 1800
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/

export async function agentEnabled(): Promise<boolean> {
  return agentReady()
}
export const digest = (value: string) => createHash('sha256').update(value).digest('hex')
export const newToken = () => randomBytes(32).toString('base64url')
export const validToken = (value: unknown): value is string => typeof value === 'string' && TOKEN_PATTERN.test(value)
export const agentLocale = (value: unknown): Locale => typeof value === 'string' && isLocale(value) ? value : 'en'

export async function getAgentToken(): Promise<string | null> {
  const token = (await cookies()).get(AGENT_COOKIE)?.value
  return validToken(token) ? token : null
}

export async function deleteAgentToken(): Promise<void> {
  ;(await cookies()).delete(AGENT_COOKIE)
}

export async function setAgentToken(token: string): Promise<void> {
  ;(await cookies()).set(AGENT_COOKIE, token, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: SESSION_LIFETIME_SECONDS,
  })
}

/** Fail closed when a browser request originates from a different website. */
export function agentSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  const target = new URL(request.url)
  if (!origin) return false
  try { return new URL(origin).host === target.host && new URL(origin).protocol === target.protocol } catch { return false }
}

export function safeMessage(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const clean = value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim()
  return clean.length >= 1 && clean.length <= MAX_CHAT_MESSAGE_LENGTH ? clean : null
}

export async function agentBudget(request: Request, token: string, action: 'chat' | 'lead' | 'register'): Promise<boolean> {
  // Hash IP before persistence. Use a server-only salt, never a raw network address.
  const salt = agentIpSalt()
  if (!salt) return false
  const ip = (request.headers.get('x-vercel-forwarded-for') || request.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim().slice(0, 100)
  const prefix = `${action}:${salt}:`
  const keys: Array<[string, number, number]> = action === 'chat'
    ? [[`ip10:${ip}`, 600, 12], [`ipday:${ip}`, 86400, 55], [`token10:${token}`, 600, 10], [`tokenday:${token}`, 86400, 40]]
    : action === 'register'
      ? [[`register10:${ip}`, 600, 7], [`registerday:${ip}`, 86400, 30], [`registertoken:${token}`, 86400, 6]]
      : [[`lead10:${ip}`, 600, 3], [`leadday:${ip}`, 86400, 7], [`leadtoken:${token}`, 86400, 3]]
  for (const [id, seconds, cap] of keys) {
    if (!await rpc<boolean>('agent_consume_quota', { p_key: digest(prefix + id), p_window_seconds: seconds, p_max: cap })) return false
  }
  return true
}

export async function agentCleanup(): Promise<void> {
  try { await rpc('agent_cleanup') } catch (e) { console.error('VORA agent cleanup skipped:', e instanceof Error ? e.message : 'error') }
}
