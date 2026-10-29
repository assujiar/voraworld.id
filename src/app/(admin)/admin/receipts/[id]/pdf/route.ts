import { sql } from '@/server/db'
import { publicBaseUrl } from '@/server/env'
import { requireUser } from '@/server/auth/guard'
import { ActionError } from '@/server/errors'
import { errorResponse, pdfResponse, routeId } from '@/server/http'
import { renderDocumentPdf } from '@/server/pdf/documents'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser(request)
    const id = routeId((await params).id)
    const [doc] = id > 0 && id < 2_147_483_647 ? await sql`select number from receipts where id = ${id}` : []
    if (!doc) throw new ActionError('Not found', 404)
    return pdfResponse(await renderDocumentPdf(sql, 'receipt', id, publicBaseUrl()), `${doc.number}.pdf`)
  } catch (e) {
    return errorResponse(e)
  }
}
