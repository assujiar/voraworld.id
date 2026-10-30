import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { documentsBucketRules } from '../helpers/bucket-rules'

export const STORAGE_KEY = 'sb_secret_httpTestKey_0123456789abcdef'

/** The per-bucket limits of migration 0013 (and what later migrations changed): a type outside the list or a file over the limit is refused, as in production. */
const BUCKET_RULES = (): Record<string, { allowed: string[]; maxBytes: number }> => ({
  'vora-media': { allowed: ['image/png', 'image/jpeg', 'image/webp', 'image/avif'], maxBytes: 7_000_000 },
  'vora-documents': documentsBucketRules(),
})

/**
 * A stand-in for Supabase Storage that enforces the rules the real service enforces and that this code has to respect:
 * a bucket's allowed file types and size limit (read from the migrations, so this stand-in cannot be more lenient than production),
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
        const rule = BUCKET_RULES()[bucket]
        const type = String(req.headers['content-type'] ?? '').split(';')[0].trim()
        if (rule && !rule.allowed.includes(type)) return reply(415, JSON.stringify({ statusCode: '415', error: 'invalid_mime_type', message: `mime type ${type} is not supported` }))
        if (rule && Buffer.concat(chunks).length > rule.maxBytes) return reply(413, JSON.stringify({ statusCode: '413', error: 'Payload too large', message: 'The object exceeded the maximum allowed size' }))
        if (objects.has(`${bucket}/${key}`) && req.headers['x-upsert'] !== 'true') return reply(409, '{"message":"The resource already exists"}')
        objects.set(`${bucket}/${key}`, { type: String(req.headers['content-type'] ?? 'application/octet-stream'), body: Buffer.concat(chunks) })
        reply(200, JSON.stringify({ Key: `${bucket}/${key}` }))
      })
      return
    }
    if (req.method === 'DELETE') { objects.delete(`${bucket}/${key}`); return reply(200, '{"message":"Successfully deleted"}') }
    const o = objects.get(`${bucket}/${key}`)
    return o ? reply(200, o.body as unknown as string, o.type) : reply(404, '{"message":"Object not found"}')
  })
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)))
}

export const storageUrl = (server: Server) => `http://127.0.0.1:${(server.address() as AddressInfo).port}`
