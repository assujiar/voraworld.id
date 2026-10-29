export function parseCookies(header: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  for (const part of (header ?? '').split(';')) {
    const i = part.indexOf('=')
    if (i < 1) continue
    const name = part.slice(0, i).trim()
    if (!(name in out)) out[name] = decodeURIComponent(part.slice(i + 1).trim())
  }
  return out
}

export const readCookie = (request: Request, name: string): string | undefined => parseCookies(request.headers.get('cookie'))[name]

/** First address from the platform-controlled forwarding headers (Vercel overwrites them at its edge). */
export function clientIp(headers: Headers): string {
  for (const name of ['x-vercel-forwarded-for', 'x-real-ip', 'x-forwarded-for']) {
    const v = headers.get(name)?.split(',')[0]?.trim()
    if (v) return v.slice(0, 64)
  }
  return ''
}
