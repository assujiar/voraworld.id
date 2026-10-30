import { documentsBucketRules } from './bucket-rules'

/**
 * A stand-in for the Storage functions of src/server/storage.ts that keeps files in a map. The unit tests have no Storage service; the
 * browser tests run against a stand-in that speaks Storage's protocol (tests/http/fake-storage.ts). Use it as
 *   const files = vi.hoisted(() => new Map<string, Uint8Array>())
 *   vi.mock('@/server/storage', async (original) => (await import('./helpers/memory-storage')).memoryStorage(await original(), files))
 *
 * It behaves like the real private bucket: a file whose type is not in the bucket's allowed list (as the migrations define it) or that is larger
 * than the bucket's limit is REFUSED with the same kind of StorageError the real provider's refusal becomes. `options.failNext` makes the next
 * uploads fail like an unreachable or denied provider, for tests of what happens to the form and the database when storage says no.
 */
export interface MemoryStorageOptions { failWith?: 'type' | 'size' | 'denied' | 'unavailable' | null; failAfter?: number; uploads?: Array<{ key: string; contentType: string; size: number }> }

export function memoryStorage<T extends object>(original: T, files: Map<string, Uint8Array>, options: MemoryStorageOptions = {}): T {
  const { StorageError } = original as unknown as { StorageError: new (message: string, status?: number, failure?: string, reference?: string) => Error }
  const rules = documentsBucketRules()
  return {
    ...original,
    putObject: async (bucket: string, key: string, bytes: Uint8Array, contentType: string) => {
      if (bucket === 'documents') {
        if (!rules.allowed.includes(contentType)) throw new StorageError('Penyimpanan dokumen menolak jenis file ini. Data belum tercatat; hubungi admin VORA', 415, 'type', 'test0001')
        if (bytes.length > rules.maxBytes) throw new StorageError('File terlalu besar untuk disimpan', 413, 'size', 'test0002')
      }
      if (options.failWith) {
        if (options.failAfter && (options.uploads?.length ?? 0) < options.failAfter) { /* the first uploads go through */ } else {
          throw new StorageError(`storage ${options.failWith}`, options.failWith === 'denied' ? 502 : 503, options.failWith, 'test0003')
        }
      }
      if (files.has(key)) throw new Error('The resource already exists')
      files.set(key, bytes)
      options.uploads?.push({ key, contentType, size: bytes.length })
    },
    removeObject: async (_bucket: string, key: string) => { files.delete(key) },
    getObject: async (_bucket: string, key: string, maxBytes: number) => {
      const f = files.get(key)
      if (!f) throw new Error('Stored file is unavailable')
      if (f.length > maxBytes) throw new Error('Stored file is larger than allowed')
      return f
    },
  }
}
