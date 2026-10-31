import { describe, expect, it } from 'vitest'
import { stagedType } from '@/server/staging'

/** The private documents bucket allows only these three types; a staged file must always be stored as one of them. */
describe('the type a staged upload is stored as', () => {
  it('is application/pdf for a PDF, image/png for a PNG and image/jpeg for a JPEG', () => {
    expect(stagedType(Uint8Array.from(Buffer.from('%PDF-1.7\n')))).toBe('application/pdf')
    expect(stagedType(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]))).toBe('image/png')
    expect(stagedType(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg')
  })
  it('is never application/octet-stream, which the bucket refuses', () => {
    for (const bytes of [new Uint8Array(0), Uint8Array.from([1, 2, 3]), Uint8Array.from(Buffer.from('plain text'))]) expect(['application/pdf', 'image/png', 'image/jpeg']).toContain(stagedType(bytes))
  })
})
