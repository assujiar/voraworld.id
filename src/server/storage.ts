import { mkdir, readdir, readFile, stat, unlink, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { data } from './data/client'
import { isProd, supabaseSecretKey, supabaseUrl } from './env'
import { ActionError } from './errors'

export type Bucket = 'media' | 'documents'

/** A storage failure. It is an ActionError, so forms show it and file routes answer with its status. */
export class StorageError extends ActionError {
  constructor(message: string, status = 502) { super(message, status) }
}

function bucketName(bucket: Bucket): string {
  return bucket === 'media' ? process.env.SUPABASE_STORAGE_BUCKET || 'vora-media' : process.env.SUPABASE_DOCUMENTS_BUCKET || 'vora-documents'
}

/** Whether the Supabase project is configured. In production the secret key only ever travels over https (loopback is allowed for local stand-ins). */
function remote(): boolean {
  const url = supabaseUrl()
  if (!url || !supabaseSecretKey()) return false
  if (isProd()) {
    let u: URL
    try { u = new URL(url) } catch { throw new StorageError('The Supabase URL is not a valid URL', 503) }
    if (u.protocol !== 'https:' && !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(u.hostname)) throw new StorageError('The Supabase URL must use https in production', 503)
  }
  return true
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
  if (remote()) {
    // upsert is off: a stored file is never overwritten, so evidence cannot be replaced by writing to its name again.
    const { error } = await data().storage.from(bucketName(bucket)).upload(key, bytes, { contentType, upsert: false })
    if (error) throw new StorageError(bucket === 'media' ? 'Storage provider upload failed' : 'Private document storage failed')
    return
  }
  if (isProd()) throw new StorageError('Storage not configured', 503)
  const path = join(localRoot(), bucket, key)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, bytes, { flag: 'wx' })
}

/** Removes a file that was stored but whose database record could not be written, so no orphan stays behind. Never throws: it is cleanup. */
export async function removeObject(bucket: Bucket, key: string): Promise<void> {
  try {
    safeKey(key)
    if (remote()) await data().storage.from(bucketName(bucket)).remove([key])
    else await unlink(join(localRoot(), bucket, key))
  } catch { /* nothing to clean up, or the cleanup itself failed: the file is unreferenced either way */ }
}

export async function getObject(bucket: Bucket, key: string, maxBytes: number): Promise<Uint8Array> {
  safeKey(key)
  if (remote()) {
    const { data: blob, error } = await data().storage.from(bucketName(bucket)).download(key)
    if (error || !blob) throw new StorageError('Stored file is unavailable')
    const buf = new Uint8Array(await blob.arrayBuffer())
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
  return remote() ? data().storage.from(bucketName('media')).getPublicUrl(key).data.publicUrl : `/uploads/${key}`
}

/** Files directly under a folder of a bucket with the time they were stored. Used only to sweep abandoned uploads. */
export async function listObjects(bucket: Bucket, folder: string): Promise<Array<{ key: string; storedAt: number }>> {
  safeKey(folder)
  if (remote()) {
    const { data: rows, error } = await data().storage.from(bucketName(bucket)).list(folder, { limit: 200 })
    if (error || !rows) return []
    return rows.filter((r) => r.name && r.created_at).map((r) => ({ key: `${folder}/${r.name}`, storedAt: Date.parse(r.created_at as string) }))
  }
  try {
    const dir = join(localRoot(), bucket, folder)
    return await Promise.all((await readdir(dir)).map(async (name) => ({ key: `${folder}/${name}`, storedAt: (await stat(join(dir, name))).mtimeMs })))
  } catch {
    return []
  }
}
