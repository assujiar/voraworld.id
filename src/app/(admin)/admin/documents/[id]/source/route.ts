import { documentType } from '@/content/document-types'
import { one } from '@/server/data'
import { requireUser } from '@/server/auth/guard'
import { readSource, type StoredFields } from '@/server/documents/general'
import { ActionError } from '@/server/errors'
import { errorResponse, pdfResponse, routeId } from '@/server/http'

/** The PDF as it arrived, before any seal was added. Only for a signed-in administrator; the sealed file is served by the pdf route. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser(request)
    const id = routeId((await params).id)
    const doc = id > 0 && id < 2_147_483_647 ? await one('documents', (q) => q.eq('id', id), 'number,kind,fields') : undefined
    const stored = doc?.fields as StoredFields | undefined
    if (!doc || documentType(doc.kind as string)?.family !== 'seal' || !stored?.source) throw new ActionError('Not found', 404)
    return pdfResponse(await readSource(stored.source), `${doc.number}-original.pdf`)
  } catch (e) {
    return errorResponse(e)
  }
}
