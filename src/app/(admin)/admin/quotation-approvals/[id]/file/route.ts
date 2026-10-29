import { requireUser } from '@/server/auth/guard'
import { readApprovalFile } from '@/server/finance/quotations'
import { errorResponse, pdfResponse, routeId } from '@/server/http'

/** The customer's signed PDF, from private storage, re-hashed against the fingerprint recorded at upload. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser(request)
    const id = routeId((await params).id)
    const { bytes } = await readApprovalFile(id > 0 && id < 2_147_483_647 ? id : 0)
    return pdfResponse(bytes, `signed-quotation-${id}.pdf`, 'attachment')
  } catch (e) {
    return errorResponse(e)
  }
}
