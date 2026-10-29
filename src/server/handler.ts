import { assertCsrf, assertSameOrigin } from './auth/csrf'
import { requireUser, type SessionUser } from './auth/guard'
import type { Permission } from './auth/roles'
import { HttpError, errorResponse } from './http'

type Params = Record<string, string>
export interface RouteCtx<P extends Params = Params> { params: Promise<P> }

export interface PostContext<P extends Params> { request: Request; form: FormData; user: SessionUser; params: P }
export interface GetContext<P extends Params> { request: Request; user: SessionUser; params: P }
export interface PublicPostContext<P extends Params> { request: Request; form: FormData; params: P }

async function readForm(request: Request): Promise<FormData> {
  try {
    return await request.formData()
  } catch {
    throw new HttpError(400, 'Invalid form submission')
  }
}

/**
 * State-changing admin action. Order matters and mirrors the previous version:
 * cross-site check -> parse -> CSRF token (403) -> signed-in (401) -> permission (403) -> handler.
 */
export function adminPost<P extends Params = Params>(permission: Permission | undefined, fn: (c: PostContext<P>) => Promise<Response>) {
  return async (request: Request, ctx: RouteCtx<P>): Promise<Response> => {
    try {
      assertSameOrigin(request)
      const form = await readForm(request)
      assertCsrf(request, form)
      const user = await requireUser(request, permission)
      return await fn({ request, form, user, params: await ctx.params })
    } catch (e) {
      return errorResponse(e)
    }
  }
}

/** Authenticated read endpoint (PDF, CSV, private file). */
export function adminGet<P extends Params = Params>(permission: Permission | undefined, fn: (c: GetContext<P>) => Promise<Response>) {
  return async (request: Request, ctx: RouteCtx<P>): Promise<Response> => {
    try {
      const user = await requireUser(request, permission)
      return await fn({ request, user, params: await ctx.params })
    } catch (e) {
      return errorResponse(e)
    }
  }
}

/** Public form post (contact, RFQ, customer approval, login): same-site + CSRF, no session required. */
export function publicPost<P extends Params = Params>(fn: (c: PublicPostContext<P>) => Promise<Response>) {
  return async (request: Request, ctx: RouteCtx<P>): Promise<Response> => {
    try {
      assertSameOrigin(request)
      const form = await readForm(request)
      assertCsrf(request, form)
      return await fn({ request, form, params: await ctx.params })
    } catch (e) {
      return errorResponse(e)
    }
  }
}
