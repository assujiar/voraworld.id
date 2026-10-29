'use server'
import { cookies } from 'next/headers'
import { ActionError, publicRun } from '@/server/action'
import { clientIp } from '@/server/auth/cookies'
import { attemptLogin } from '@/server/auth/login'
import { SESSION_COOKIE, cookieOptions } from '@/server/auth/session'
import { redirect } from 'next/navigation'
import { str } from '@/server/http'

/** Only same-site admin paths are accepted as a post-login destination (no open redirect, no path traversal). */
const safeNext = (v: string) => (/^\/admin(?:[/?][^\s\\]*)?$/.test(v) && !v.includes('..') && !v.includes('//') ? v : '/admin')

export async function login(form: FormData) {
  const next = safeNext(str(form, 'next', 400))
  return publicRun(form, '/admin/login' + (next === '/admin' ? '' : `?next=${encodeURIComponent(next)}`), async ({ headers }) => {
    const result = await attemptLogin(str(form, 'email', 200), String(form.get('password') ?? '').slice(0, 1000), clientIp(headers))
    if (result.status === 'blocked') throw new ActionError('Too many failed attempts. Try again later.', 429)
    if (result.status === 'invalid') throw new ActionError('Invalid login details', 401)
    ;(await cookies()).set(SESSION_COOKIE, result.token, cookieOptions())
    return { to: next, query: '' }
  })
}

export async function logout(form: FormData) {
  return publicRun(form, '/admin/login', async () => {
    ;(await cookies()).delete(SESSION_COOKIE)
    redirect('/admin/login')
  })
}
