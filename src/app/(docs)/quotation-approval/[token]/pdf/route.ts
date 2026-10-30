import { sql } from '@/server/db'
import { publicBaseUrl } from '@/server/env'
import { ActionError } from '@/server/errors'
import { approvalByToken } from '@/server/finance/quotations'
import { errorResponse, pdfResponse } from '@/server/http'
import { renderDocumentPdf } from '@/server/pdf/documents'

/** The quotation as the customer is meant to sign it. Needs the private link; works while the request is pending or submitted. */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const a = await approvalByToken((await params).token)
    if (!a) throw new ActionError('Not found', 404)
    if (a.quotationStatus === 'void' || !['pending', 'submitted'].includes(a.status) || a.expiresAt.getTime() < Date.now()) throw new ActionError('This approval request is no longer available', 410)
    return pdfResponse(await renderDocumentPdf(sql, 'quotation', a.quotationId, publicBaseUrl()), 'VORA_Price_Agreement_Letter.pdf', 'attachment')
  } catch (e) {
    return errorResponse(e)
  }
}
