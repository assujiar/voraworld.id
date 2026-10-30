/**
 * A stand-in for the Storage functions of src/server/storage.ts that keeps files in a map. The unit tests have no Storage service; the
 * browser tests run against a stand-in that speaks Storage's protocol (tests/http/fake-storage.ts). Use it as
 *   const files = vi.hoisted(() => new Map<string, Uint8Array>())
 *   vi.mock('@/server/storage', async (original) => (await import('./helpers/memory-storage')).memoryStorage(await original(), files))
 */
export function memoryStorage<T extends object>(original: T, files: Map<string, Uint8Array>): T {
  return {
    ...original,
    putObject: async (_bucket: string, key: string, bytes: Uint8Array) => { if (files.has(key)) throw new Error('The resource already exists'); files.set(key, bytes) },
    removeObject: async (_bucket: string, key: string) => { files.delete(key) },
    getObject: async (_bucket: string, key: string, maxBytes: number) => {
      const f = files.get(key)
      if (!f) throw new Error('Stored file is unavailable')
      if (f.length > maxBytes) throw new Error('Stored file is larger than allowed')
      return f
    },
  }
}
