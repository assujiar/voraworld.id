import { randomBytes } from 'node:crypto'
import { ActionError } from './errors'
import { getObject, listObjects, putObject, removeObject } from './storage'
import { maxUploadBytes } from './env'

const FOLDER = 'staging'
const TOKEN = /^[0-9]{1,10}_[A-Za-z0-9_-]{24,64}$/
const KEEP_MS = 60 * 60 * 1000

/**
 * A file that arrived ahead of its form. The browser sends a chosen file here first, over a request whose progress it can measure, then submits the
 * form with the returned token in place of the file; the action receives an ordinary File again (see `takeStaged`). Files that were never used by a
 * form are removed after an hour. A token names the account that made it and is useless to anyone else.
 */
/**
 * The type the private documents bucket accepts for these bytes. A staged file is only ever a PDF or a photo, and the bucket allows exactly those types: storing it
 * as application/octet-stream is refused by Supabase Storage, so the upload would fail before it reached the form. A file that is none of them is stored as a PDF
 * all the same: the action that finally uses it checks what it really is and refuses it with its own message.
 */
export function stagedType(bytes: Uint8Array): 'application/pdf' | 'image/png' | 'image/jpeg' {
  if (bytes.length > 3 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png'
  if (bytes.length > 2 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  return 'application/pdf'
}

export async function stageUpload(userId: number, bytes: Uint8Array): Promise<string> {
  if (!bytes.length) throw new ActionError('The file is empty')
  if (bytes.length > maxUploadBytes()) throw new ActionError(`The file exceeds the ${Math.floor(maxUploadBytes() / 1048576)} MB limit`, 413)
  const token = `${userId}_${randomBytes(24).toString('base64url')}`
  await putObject('documents', `${FOLDER}/${token}`, bytes, stagedType(bytes))
  void purgeStaged()                                                       // best effort, never delays or fails the upload
  return token
}

/** Replaces every `<field>__staged` token in the form by the file it names, so that the action sees the same form a plain upload would have sent. */
export async function takeStaged(form: FormData, userId: number): Promise<void> {
  for (const key of [...form.keys()]) {
    if (!key.endsWith('__staged')) continue
    const field = key.slice(0, -'__staged'.length)
    const token = String(form.get(key) ?? '')
    form.delete(key)
    if (!TOKEN.test(token) || !token.startsWith(`${userId}_`)) throw new ActionError('The uploaded file was not accepted. Choose the file again.')
    let bytes: Uint8Array
    try { bytes = await getObject('documents', `${FOLDER}/${token}`, maxUploadBytes()) } catch { throw new ActionError('The uploaded file is no longer available. Choose the file again.') }
    await removeObject('documents', `${FOLDER}/${token}`)
    const name = String(form.get(`${field}__name`) ?? 'upload').split(/[\\/]/).pop()!.slice(0, 250) || 'upload'
    const type = String(form.get(`${field}__type`) ?? '').slice(0, 100)
    form.delete(`${field}__name`); form.delete(`${field}__type`)
    form.set(field, new File([Buffer.from(bytes)], name, { type }))
  }
}

async function purgeStaged(): Promise<void> {
  try {
    const old = (await listObjects('documents', FOLDER)).filter((o) => Date.now() - o.storedAt > KEEP_MS)
    await Promise.all(old.map((o) => removeObject('documents', o.key)))
  } catch { /* the next upload tries again */ }
}
