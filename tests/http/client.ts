/** Tiny HTTP client with a cookie jar and manual redirects, enough for server-rendered pages. */
export class Client {
  cookies = new Map<string, string>()
  constructor(public base = process.env.HTTP_BASE_URL!) {}

  private jar(): string { return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ') }
  private store(res: Response) {
    for (const line of res.headers.getSetCookie?.() ?? []) {
      const [pair, ...attrs] = line.split(';')
      const i = pair.indexOf('=')
      const name = pair.slice(0, i).trim()
      const expired = attrs.some((a) => /^\s*(max-age=0|expires=.*1970)/i.test(a))
      if (expired || !pair.slice(i + 1)) this.cookies.delete(name)
      else this.cookies.set(name, pair.slice(i + 1).trim())
    }
  }
  async request(path: string, init: RequestInit & { headers?: Record<string, string> } = {}): Promise<Response> {
    const res = await fetch(path.startsWith('http') ? path : this.base + path, { redirect: 'manual', ...init, headers: { ...(init.headers ?? {}), cookie: this.jar() } })
    this.store(res)
    return res
  }
  get = (path: string, headers: Record<string, string> = {}) => this.request(path, { headers })
  async text(path: string) { return (await this.get(path)).text() }
}
