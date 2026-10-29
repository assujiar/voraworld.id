import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { assertSameOrigin } from './auth/csrf'
import { userFromToken, assertPermission, type SessionUser } from './auth/guard'
import type { Permission } from './auth/roles'
import { SESSION_COOKIE } from './auth/session'
import { HttpError } from './http'

/** Business-rule or validation failure: shown to the user on the form they came from. */
export class ActionError extends Error {
  constructor(message: string, public status = 422) {
    super(message)
  }
}

export interface Done { to: string; notice?: string }
export interface AdminCtx { form: FormData; user: SessionUser }
export interface PublicCtx { form: FormData; headers: Headers }

/** Every action is registered here, so tests can prove that none is exported without its guard. */
export const ACTION_REGISTRY = new Map<string, { kind: 'admin' | 'public'; permission?: Permission }>()

const safeLocal = (p: string | null | undefined, fallback: string) => (p && p.startsWith('/') && !p.startsWith('//') && !p.includes('\\') ? p : fallback)

function withQuery(path: string, key: string, value: string) {
  return path + (path.includes('?') ? '&' : '?') + key + '=' + encodeURIComponent(value)
}

export function doneUrl(d: Done): string {
  return d.notice ? withQuery(d.to, 'notice', d.notice) : withQuery(d.to, 'saved', '1')
}

async function execute<T>(form: FormData, back: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (e) {
    if (e instanceof ActionError) redirect(withQuery(safeLocal(String(form.get('_back') ?? ''), back), 'error', e.message))
    throw e
  }
}

/** Signed-in admin action. Order: same-origin -> signed in (else login page) -> permission (403) -> handler. */
export function adminAction(name: string, permission: Permission | undefined, fn: (c: AdminCtx) => Promise<Done | void>) {
  ACTION_REGISTRY.set(name, { kind: 'admin', permission })
  return async function action(form: FormData): Promise<void> {
    assertSameOrigin(await headers())
    const user = await userFromToken((await cookies()).get(SESSION_COOKIE)?.value)
    if (!user) redirect('/admin/login')
    assertPermission(user, permission)
    const result = await execute(form, '/admin', () => fn({ form, user }))
    if (result) redirect(doneUrl(result))
  }
}

/** Action for visitors (contact form, RFQ, customer approval upload, login). */
export function publicAction(name: string, fn: (c: PublicCtx) => Promise<Done | void>, errorBack = '/') {
  ACTION_REGISTRY.set(name, { kind: 'public' })
  return async function action(form: FormData): Promise<void> {
    const h = await headers()
    assertSameOrigin(h)
    const result = await execute(form, errorBack, () => fn({ form, headers: h }))
    if (result) redirect(doneUrl(result))
  }
}

export { HttpError }
