import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { assertSameOrigin } from './auth/csrf'
import { currentUser, assertAdmin, type SessionUser } from './auth/guard'
import { ActionError } from './errors'
import { HttpError } from './http'

export { ActionError }

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
  const user = await currentUser()
  if (!user) redirect('/admin/login')
  assertAdmin(user)
  await execute(form, '/admin', () => fn({ form, user }))
}

/** What a form-state action hands back to its form when the submission is refused: the message and what was typed. */
export interface FormState { error?: string; values?: Record<string, string | string[]> }

/** The text the user typed (never files), so a refused form can be shown again with everything still filled in. */
function typedValues(form: FormData): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {}
  for (const key of new Set(form.keys())) {
    if (key.startsWith('$ACTION') || key === '_back') continue
    const all = form.getAll(key).filter((v): v is string => typeof v === 'string')
    if (!all.length) continue
    out[key] = all.length > 1 ? all.map((v) => v.slice(0, 12_000)) : all[0].slice(0, 12_000)
  }
  return out
}

/**
 * Same guard as `adminRun`, for long forms that use React's `useActionState`: a refused submission returns
 * `{ error, values }` instead of navigating, so nothing the user typed is lost. Success redirects as usual.
 */
export async function adminRunForm(form: FormData, fn: (c: AdminCtx) => Promise<Done>): Promise<FormState> {
  assertSameOrigin(await headers())
  const user = await currentUser()
  if (!user) redirect('/admin/login')
  assertAdmin(user)
  let result: Done
  try {
    result = await fn({ form, user })
  } catch (e) {
    if (e instanceof ActionError) return { error: e.message, values: typedValues(form) }
    throw e
  }
  redirect(doneUrl(result))
}

/** Guard for actions open to visitors (contact form, RFQ, customer approval upload, login). */
export async function publicRun(form: FormData, errorBack: string, fn: (c: PublicCtx) => Promise<Done | void>): Promise<void> {
  const h = await headers()
  assertSameOrigin(h)
  await execute(form, errorBack, () => fn({ form, headers: h }))
}

export { HttpError }
