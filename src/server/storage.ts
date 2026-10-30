import { randomBytes } from 'node:crypto'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { data } from './data/client'
import { isProd, supabaseSecretKey, supabaseUrl } from './env'
import { ActionError } from './errors'

export type Bucket = 'media' | 'documents'

/** What went wrong at the provider, in terms the application can act on. */
export type StorageFailure = 'type' | 'size' | 'conflict' | 'denied' | 'unavailable' | 'unknown'

/**
 * A storage failure. It is an ActionError, so forms show it and file routes answer with its status. `message` is safe to show to anyone (it names
 * neither the bucket, a key nor a policy); `failure` says what kind it was, and `reference` is a short code that appears in the server log next to
 * the provider's own words, so that a person reporting the message can be matched to its cause.
 */
export class StorageError extends ActionError {
  constructor(message: string, status = 502, public failure: StorageFailure = 'unknown', public reference = '') { super(message, status) }
}

/** Sorts the provider's error (storage-js `StorageApiError`: message, statusCode, error) into a kind. Only these three fields are read. */
export function classifyProviderError(error: { message?: string; statusCode?: string | number; status?: number; error?: string } | null | undefined): StorageFailure {
  const text = `${error?.message ?? ''} ${error?.error ?? ''}`.toLowerCase()
  const code = Number(error?.statusCode ?? error?.status ?? 0)
  if (/mime|content.?type|not supported|invalid_mime/.test(text) || code === 415) return 'type'
  if (/exceed|too large|maximum allowed size|payload/.test(text) || code === 413) return 'size'
  if (/already exists|duplicate/.test(text) || code === 409) return 'conflict'
  if (/row-level security|unauthori[sz]ed|forbidden|permission|jwt|api key|invalid signature/.test(text) || code === 401 || code === 403) return 'denied'
  if (code >= 500 || /fetch failed|timeout|timed out|econn|enotfound|network/.test(text)) return 'unavailable'
  return 'unknown'
}

/** What a person is told. Specific enough to act on, and silent about the bucket, the policy and the credentials. */
function messageFor(bucket: Bucket, failure: StorageFailure, reference: string): string {
  const ref = reference ? ` (kode ${reference})` : ''
  if (bucket === 'media') {
    if (failure === 'type') return `Jenis gambar ini tidak diterima oleh penyimpanan. Gunakan PNG, JPEG, WEBP atau AVIF${ref}`
    if (failure === 'size') return `Gambar terlalu besar untuk penyimpanan${ref}`
    return `Gambar belum berhasil diunggah. Coba lagi${ref}`
  }
  if (failure === 'type') return `Penyimpanan dokumen menolak jenis file ini. Data belum tercatat; hubungi admin VORA${ref}`
  if (failure === 'size') return `File terlalu besar untuk disimpan. Kecilkan ukurannya atau ambil foto baru, lalu kirim kembali${ref}`
  if (failure === 'unavailable') return `Penyimpanan bukti sedang bermasalah. Data belum tercatat. Coba lagi beberapa saat lagi${ref}`
  if (failure === 'conflict') return `File ini sudah pernah tersimpan. Kirim ulang formulir${ref}`
  return `Bukti belum berhasil diunggah. Data belum tercatat. Silakan coba lagi${ref}`
}

/** One line in the server log for a failed storage call: the operation, the kind of file and the provider's own error, never the key, the contents or a credential. */
function logFailure(op: string, bucket: Bucket, contentType: string, size: number, key: string, error: { message?: string; statusCode?: string | number; status?: number; error?: string; name?: string } | null | undefined, failure: StorageFailure, reference: string): void {
  console.error('[storage]', JSON.stringify({
    event: 'storage_failure', reference, op, bucket: bucketName(bucket), contentType, size, folder: key.split('/').slice(0, 1).join('/'), failure,
    providerStatus: error?.statusCode ?? error?.status ?? null, providerError: error?.error ?? error?.name ?? null, providerMessage: String(error?.message ?? '').slice(0, 240),
  }))
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
    let error: Awaited<ReturnType<ReturnType<ReturnType<typeof data>['storage']['from']>['upload']>>['error'] | { message: string } | null
    try { error = (await data().storage.from(bucketName(bucket)).upload(key, bytes, { contentType, upsert: false })).error } catch (e) { error = { message: e instanceof Error ? e.message : 'upload failed' } }
    if (error) {
      const failure = classifyProviderError(error as never)
      const reference = randomBytes(4).toString('hex')
      logFailure('upload', bucket, contentType, bytes.length, key, error as never, failure, reference)
      throw new StorageError(messageFor(bucket, failure, reference), failure === 'size' ? 413 : failure === 'type' ? 415 : failure === 'unavailable' ? 503 : 502, failure, reference)
    }
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
