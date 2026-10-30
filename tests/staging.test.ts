import { describe, expect, it, vi } from 'vitest'
import { ActionError } from '@/server/errors'
import { stageUpload, takeStaged } from '@/server/staging'

const files = vi.hoisted(() => new Map<string, Uint8Array>())
vi.mock('@/server/storage', async (original) => (await import('./helpers/memory-storage')).memoryStorage(await original(), files))

const bytes = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52, 10])
const formWith = (token: string, extra: Record<string, string> = {}) => {
  const f = new FormData()
  f.set('source_pdf__staged', token); f.set('source_pdf__name', 'C:\\fakepath\\ijazah.pdf'); f.set('source_pdf__type', 'application/pdf')
  for (const [k, v] of Object.entries(extra)) f.set(k, v)
  return f
}

describe('files staged ahead of their form', () => {
  it('come back as an ordinary File, once, under the name and type the browser gave', async () => {
    const token = await stageUpload(7, bytes)
    expect(token.startsWith('7_')).toBe(true)
    const form = formWith(token, { note: 'kept' })
    await takeStaged(form, 7)
    const file = form.get('source_pdf') as File
    expect(file).toBeInstanceOf(File)
    expect(file.name).toBe('ijazah.pdf')                                           // the path of the sender's computer is dropped
    expect(file.type).toBe('application/pdf')
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(bytes)
    expect(form.get('note')).toBe('kept')
    expect([...form.keys()].filter((k) => k.includes('__'))).toEqual([])           // no token fields are left for the action to trip over
    expect([...files.keys()].some((k) => k.includes(token))).toBe(false)           // and the staged copy is gone
    await expect(takeStaged(formWith(token), 7)).rejects.toThrow(ActionError)      // a token cannot be used twice
  })

  it('are refused for another account, a made-up token, or an empty file', async () => {
    const token = await stageUpload(7, bytes)
    await expect(takeStaged(formWith(token), 8)).rejects.toThrow('not accepted')
    await expect(takeStaged(formWith('7_forgedforgedforgedforgedforged'), 7)).rejects.toThrow('no longer available')
    await expect(takeStaged(formWith('../../etc/passwd'), 7)).rejects.toThrow('not accepted')
    await expect(stageUpload(7, new Uint8Array())).rejects.toThrow('empty')
    await takeStaged(formWith(token), 7)                                           // the rightful owner still can
  })

  it('leave a form without files exactly as it was', async () => {
    const form = new FormData(); form.set('a', '1')
    await takeStaged(form, 7)
    expect([...form.entries()]).toEqual([['a', '1']])
  })
})
