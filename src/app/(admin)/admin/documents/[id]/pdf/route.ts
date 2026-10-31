import { fileName } from '@/content/file-names'
import { one } from '@/server/data'
import { publicBaseUrl } from '@/server/env'
import { requireUser } from '@/server/auth/guard'
import { ActionError } from '@/server/errors'
import { errorResponse, pdfResponse, routeId } from '@/server/http'
import { renderDocumentPdf } from '@/server/pdf/documents'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser(request)
    const id = routeId((await params).id)
    const doc = id > 0 && id < 2_147_483_647 ? await one('documents', (q) => q.eq('id', id), 'number,subject') : undefined
    if (!doc) throw new ActionError('Not found', 404)
    return pdfResponse(await renderDocumentPdf('document', id, publicBaseUrl()), fileName(doc.number as string, doc.subject as string))
  } catch (e) {
    return errorResponse(e)
  }
}
