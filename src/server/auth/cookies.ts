/** First address from the platform-controlled forwarding headers (Vercel overwrites them at its edge). */
export function clientIp(headers: Headers): string {
  for (const name of ['x-vercel-forwarded-for', 'x-real-ip', 'x-forwarded-for']) {
    const v = headers.get(name)?.split(',')[0]?.trim()
    if (v) return v.slice(0, 64)
  }
  return ''
}
