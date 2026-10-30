'use server'
import { redirect } from 'next/navigation'
import { ActionError, adminRun, publicRun } from '@/server/action'
import { clientIp } from '@/server/auth/cookies'
import { attemptLogin, requestPasswordReset } from '@/server/auth/login'
import { MIN_PASSWORD_LENGTH } from '@/server/auth/policy'
import { publicBaseUrl } from '@/server/env'
import { str } from '@/server/http'
import { supabaseForRequest } from '@/server/supabase/clients'

/** Only same-site admin paths are accepted as a post-login destination (no open redirect, no path traversal). */
const safeNext = (v: string) => (/^\/admin(?:[/?][^\s\\]*)?$/.test(v) && !v.includes('..') && !v.includes('//') ? v : '/admin')

export async function login(form: FormData) {
  const next = safeNext(str(form, 'next', 400))
  return publicRun(form, '/admin/login' + (next === '/admin' ? '' : `?next=${encodeURIComponent(next)}`), async ({ headers }) => {
    const result = await attemptLogin(str(form, 'email', 200), String(form.get('password') ?? '').slice(0, 1000), clientIp(headers))
    if (result.status === 'blocked') throw new ActionError('Too many failed attempts. Try again later.', 429)
    if (result.status === 'invalid') throw new ActionError('Invalid login details', 401)
    return { to: next, query: '' }
  })
}

export async function logout(form: FormData) {
  return publicRun(form, '/admin/login', async () => {
    await (await supabaseForRequest()).auth.signOut({ scope: 'local' })            // this browser only; other sessions of the account stay
    redirect('/admin/login')
  })
}

/** Always answers the same, whether or not the address belongs to an administrator. */
export async function forgotPassword(form: FormData) {
  return publicRun(form, '/admin/forgot-password', async ({ headers }) => {
    const redirectTo = `${publicBaseUrl()}/admin/auth/callback?next=${encodeURIComponent('/admin/reset-password')}`
    const result = await requestPasswordReset(str(form, 'email', 200), clientIp(headers), redirectTo)
    if (result === 'blocked') throw new ActionError('Too many requests. Try again later.', 429)
    return { to: '/admin/login', notice: 'If that address belongs to an administrator, a reset link has been sent.' }
  })
}

/** The emailed link signs the administrator in (see /admin/auth/callback); this sets the new password and ends every other session of the account. */
export async function resetPassword(form: FormData) {
  return adminRun(form, async () => {
    const password = String(form.get('password') ?? '')
    if (password.length < MIN_PASSWORD_LENGTH) throw new ActionError(`The password must have at least ${MIN_PASSWORD_LENGTH} characters`)
    if (password !== String(form.get('confirm') ?? '')) throw new ActionError('The two passwords do not match')
    const supabase = await supabaseForRequest()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw new ActionError(error.message.slice(0, 200))
    await supabase.auth.signOut({ scope: 'others' })
    return { to: '/admin', notice: 'Password changed' }
  })
}
