import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { isProd, supabaseSecretKey } from './env'
import { ActionError } from './errors'

export type Bucket = 'media' | 'documents'

/** A storage failure. It is an ActionError, so forms show it and file routes answer with its status. */
export class StorageError extends ActionError {
  constructor(message: string, status = 502) { super(message, status) }
}

/**
 * Headers for the Supabase Storage REST API. Legacy `service_role` keys are JWTs and go in both `apikey` and
 * Bearer. New-style `sb_secret_...` keys are NOT JWTs: Supabase answers "Invalid JWT" if they appear in
 * `Authorization: Bearer`, so they are sent in `apikey` only.
 */
export function supabaseHeaders(secret: string, contentType?: string): Record<string, string> {
  const headers: Record<string, string> = { apikey: secret }
  if (secret.startsWith('eyJ')) headers.Authorization = `Bearer ${secret}`
  if (contentType) headers['Content-Type'] = contentType
  return headers
}

function bucketName(bucket: Bucket): string {
  return bucket === 'media' ? process.env.SUPABASE_STORAGE_BUCKET || 'vora-media' : process.env.SUPABASE_DOCUMENTS_BUCKET || 'vora-documents'
}

const LOOPBACK = /^(localhost|127\.0\.0\.1|\[::1\])$/

/** The Supabase project, if configured. In production the secret key only ever travels over https (loopback is allowed for local stand-ins). */
function remote(): { url: string; secret: string } | null {
  const url = (process.env.SUPABASE_URL || '').replace(/\/+$/, '')
  const secret = supabaseSecretKey()
  if (!url || !secret) return null
  if (isProd()) {
    let host = ''
    try { const u = new URL(url); host = u.protocol === 'https:' ? '' : u.hostname } catch { throw new StorageError('SUPABASE_URL is not a valid URL', 503) }
    if (host && !LOOPBACK.test(host)) throw new StorageError('SUPABASE_URL must use https in production', 503)
  }
  return { url, secret }
}

/** Local directory used when Supabase is not configured (development and tests only). */
export function localRoot(): string {
  return resolve(process.env.VORA_LOCAL_STORAGE_DIR || join(process.cwd(), '.local-storage'))
}

function safeKey(key: string): string {
  if (!/^[A-Za-z0-9_\-/]+(\.[A-Za-z0-9]+)?$/.test(key) || key.includes('..')) throw new StorageError('Invalid storage key', 400)
  return key
}

export async function putObject(bucket: Bucket, key: string, bytes: Uint8Array, contentType: string): Promise<void> {
  safeKey(key)
  const r = remote()
  if (r) {
    const res = await fetch(`${r.url}/storage/v1/object/${bucketName(bucket)}/${key}`, {
      method: 'POST', headers: { ...supabaseHeaders(r.secret, contentType), 'x-upsert': 'false' }, body: Buffer.from(bytes), signal: AbortSignal.timeout(30_000),
    }).catch(() => null)
    if (!res || !res.ok) throw new StorageError(bucket === 'media' ? 'Storage provider upload failed' : 'Private document storage failed')
    return
  }
  if (isProd()) throw new StorageError('Storage not configured', 503)
  const path = join(localRoot(), bucket, key)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, bytes, { flag: 'wx' })
}

export async function getObject(bucket: Bucket, key: string, maxBytes: number): Promise<Uint8Array> {
  safeKey(key)
  const r = remote()
  if (r) {
    const res = await fetch(`${r.url}/storage/v1/object/${bucketName(bucket)}/${key}`, { headers: supabaseHeaders(r.secret), signal: AbortSignal.timeout(30_000) }).catch(() => null)
    if (!res || !res.ok) throw new StorageError('Stored file is unavailable')
    const buf = new Uint8Array(await res.arrayBuffer())
    if (buf.length > maxBytes) throw new StorageError('Stored file is larger than allowed')
    return buf
  }
  if (isProd()) throw new StorageError('Private PDF storage is not configured', 503)
  try {
    return new Uint8Array(await readFile(join(localRoot(), bucket, key)))
  } catch {
    throw new StorageError('Stored file is unavailable')
  }
}

/** Public URL of a media object: Supabase public bucket in production, `/uploads/...` locally. */
export function mediaUrl(key: string): string {
  const r = remote()
  return r ? `${r.url}/storage/v1/object/public/${bucketName('media')}/${key}` : `/uploads/${key}`
}
