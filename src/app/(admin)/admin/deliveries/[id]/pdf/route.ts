import { requireUser } from '@/server/auth/guard'
import { deliveryBy } from '@/server/delivery/deliveries'
import { publicBaseUrl } from '@/server/env'
import { ActionError } from '@/server/errors'
import { errorResponse, pdfResponse, routeId } from '@/server/http'
import { deliveryNotePdf } from '@/server/pdf/delivery-render'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser(request)
    const id = routeId((await params).id)
    const d = id > 0 && id < 2_147_483_647 ? await deliveryBy('id', id) : null
    if (!d) throw new ActionError('Not found', 404)
    return pdfResponse(await deliveryNotePdf(id, publicBaseUrl()), `${d.number}.pdf`)
  } catch (e) {
    return errorResponse(e)
  }
}
