import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'

export const STORAGE_KEY = 'sb_secret_httpTestKey_0123456789abcdef'

/**
 * A stand-in for Supabase Storage that enforces the rules the real service enforces and that this code has to respect:
 * a new-style `sb_secret_` key is accepted in `apikey` only (never as a Bearer token: "Invalid JWT"), private buckets need
 * the key, only the media bucket is publicly readable, and an upload never overwrites (`x-upsert: false`).
 */
export function fakeStorage(secret: string = STORAGE_KEY): Promise<Server> {
  const objects = new Map<string, { type: string; body: Buffer }>()
  const server = createServer((req, res) => {
    const reply = (status: number, body: string, type = 'application/json') => { res.writeHead(status, { 'content-type': type }); res.end(body) }
    const m = /^\/storage\/v1\/object\/(public\/)?([^/]+)\/(.+)$/.exec(new URL(req.url!, 'http://x').pathname)
    if (!m) return reply(404, '{"message":"not found"}')
    const [, pub, bucket, key] = m
    const bearer = /^Bearer (.+)$/.exec(String(req.headers.authorization ?? ''))?.[1]
    if (pub) {
      const o = bucket === 'vora-media' ? objects.get(`${bucket}/${key}`) : undefined
      return o ? reply(200, o.body as unknown as string, o.type) : reply(400, '{"message":"Bucket not found"}')
    }
    if (bearer && !bearer.startsWith('eyJ')) return reply(401, '{"message":"Invalid JWT"}')
    if (req.headers.apikey !== secret) return reply(401, '{"message":"Invalid API key"}')
    if (req.method === 'POST') {
      const chunks: Buffer[] = []
      req.on('data', (c) => chunks.push(c))
      req.on('end', () => {
        if (objects.has(`${bucket}/${key}`) && req.headers['x-upsert'] !== 'true') return reply(409, '{"message":"The resource already exists"}')
        objects.set(`${bucket}/${key}`, { type: String(req.headers['content-type'] ?? 'application/octet-stream'), body: Buffer.concat(chunks) })
        reply(200, JSON.stringify({ Key: `${bucket}/${key}` }))
      })
      return
    }
    const o = objects.get(`${bucket}/${key}`)
    return o ? reply(200, o.body as unknown as string, o.type) : reply(404, '{"message":"Object not found"}')
  })
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)))
}

export const storageUrl = (server: Server) => `http://127.0.0.1:${(server.address() as AddressInfo).port}`
