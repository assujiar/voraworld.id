import { assertSameOrigin } from '@/server/auth/csrf'
import { requireUser } from '@/server/auth/guard'
import { maxUploadBytes } from '@/server/env'
import { errorResponse } from '@/server/http'
import { stageUpload } from '@/server/staging'

/** Receives one chosen file ahead of its form, so that the browser can show how much of it has really gone up. Answers with the token the form sends instead of the file. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request.headers)
    const user = await requireUser(request)
    const declared = Number(request.headers.get('content-length') ?? 0)
    if (declared > maxUploadBytes() + 64 * 1024) return Response.json({ error: `The file exceeds the ${Math.floor(maxUploadBytes() / 1048576)} MB limit` }, { status: 413 })
    const file = (await request.formData()).get('file')
    if (!(file instanceof File) || file.size === 0) return Response.json({ error: 'No file was received' }, { status: 400 })
    const token = await stageUpload(user.id, new Uint8Array(await file.arrayBuffer()))
    return Response.json({ token }, { headers: { 'cache-control': 'no-store' } })
  } catch (e) {
    return errorResponse(e)
  }
}
