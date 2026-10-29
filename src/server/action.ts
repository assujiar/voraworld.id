import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { assertSameOrigin } from './auth/csrf'
import { userFromToken, assertAdmin, type SessionUser } from './auth/guard'
import { SESSION_COOKIE } from './auth/session'
import { HttpError } from './http'

/** Business-rule or validation failure: shown to the user on the form they came from. */
export class ActionError extends Error {
  constructor(message: string, public status = 422) {
    super(message)
  }
}

/** Where to go after success. `query` replaces the default `saved=1`, e.g. `sent=1` for public forms. */
export interface Done { to: string; notice?: string; query?: string }
export interface AdminCtx { form: FormData; user: SessionUser }
export interface PublicCtx { form: FormData; headers: Headers }

const safeLocal = (p: string | null | undefined, fallback: string) => (p && p.startsWith('/') && !p.startsWith('//') && !p.includes('\\') ? p : fallback)

function withQuery(path: string, key: string, value: string) {
  return path + (path.includes('?') ? '&' : '?') + key + '=' + encodeURIComponent(value)
}

export function doneUrl(d: Done): string {
  if (d.query !== undefined) return d.query ? d.to + (d.to.includes('?') ? '&' : '?') + d.query : d.to
  return d.notice ? withQuery(d.to, 'notice', d.notice) : withQuery(d.to, 'saved', '1')
}

async function execute(form: FormData, back: string, run: () => Promise<Done | void>): Promise<void> {
  let result: Done | void
  try {
    result = await run()
  } catch (e) {
    if (e instanceof ActionError) redirect(withQuery(safeLocal(String(form.get('_back') ?? ''), back), 'error', e.message))
    throw e
  }
  if (result) redirect(doneUrl(result))
}

/**
 * Guard for every signed-in admin action. Each exported action in src/actions/ must be an `async function`
 * whose body is `return adminRun(form, fn)`: a test checks the source and executes every action as an
 * anonymous visitor and as an account without the admin role.
 * Order: same-origin -> signed in (else login page) -> admin role (403) -> handler.
 */
export async function adminRun(form: FormData, fn: (c: AdminCtx) => Promise<Done | void>): Promise<void> {
  assertSameOrigin(await headers())
  const user = await userFromToken((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user) redirect('/admin/login')
  assertAdmin(user)
  await execute(form, '/admin', () => fn({ form, user }))
}

/** Guard for actions open to visitors (contact form, RFQ, customer approval upload, login). */
export async function publicRun(form: FormData, errorBack: string, fn: (c: PublicCtx) => Promise<Done | void>): Promise<void> {
  const h = await headers()
  assertSameOrigin(h)
  await execute(form, errorBack, () => fn({ form, headers: h }))
}

export { HttpError }
