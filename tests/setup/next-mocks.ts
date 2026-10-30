import { vi } from 'vitest'

/**
 * Server Actions read the session cookie and request headers from `next/headers` and finish with `redirect()`.
 * These mocks give tests control of that request context so actions can be called as ordinary functions.
 */
export class RedirectSignal extends Error {
  constructor(public url: string, public permanent = false) { super(`NEXT_REDIRECT ${url}`) }
}
export class NotFoundSignal extends Error { constructor() { super('NEXT_NOT_FOUND') } }

export const requestContext = {
  cookies: new Map<string, string>(),
  headers: new Headers({ host: 'testserver' }),
}
;(globalThis as Record<string, unknown>).__voraRequestContext = requestContext
;(globalThis as Record<string, unknown>).__voraSignals = { RedirectSignal, NotFoundSignal }

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (requestContext.cookies.has(name) ? { name, value: requestContext.cookies.get(name)! } : undefined),
    getAll: () => [...requestContext.cookies].map(([name, value]) => ({ name, value })),
    // A cookie set with no value or maxAge 0 is how Supabase clears a session.
    set: (name: string, value: string, options?: { maxAge?: number }) => { if (!value || options?.maxAge === 0) requestContext.cookies.delete(name); else requestContext.cookies.set(name, value) },
    delete: (name: string) => { requestContext.cookies.delete(name) },
  }),
  headers: async () => requestContext.headers,
}))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => { throw new RedirectSignal(url) },
  permanentRedirect: (url: string) => { throw new RedirectSignal(url, true) },
  notFound: () => { throw new NotFoundSignal() },
}))
vi.mock('next/server', async (original) => ({ ...(await original<typeof import('next/server')>()), after: (fn: () => unknown) => { queueMicrotask(() => { void fn() }) } }))
