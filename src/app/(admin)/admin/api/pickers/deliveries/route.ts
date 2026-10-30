import { many, one } from '@/server/data'
import { requireUser } from '@/server/auth/guard'
import { errorResponse } from '@/server/http'

const id = (v: string | null) => (/^\d{1,10}$/.test(v ?? '') && Number(v) <= 2_147_483_647 ? Number(v) : 0)

/** The delivered delivery notes of one quotation, and which of them an invoice already bills, for the invoice picker. */
export async function GET(request: Request) {
  try {
    await requireUser(request)
    const params = new URL(request.url).searchParams
    const customerId = id(params.get('customer')), quotationId = id(params.get('quotation'))
    const quotation = customerId && quotationId ? await one('quotations', (q) => q.eq('id', quotationId).eq('customer_id', customerId), 'id,number,status') : undefined
    if (!quotation || quotation.status !== 'validated') return Response.json({ error: 'That quotation is not a validated quotation of this customer.' }, { status: 404, headers: { 'cache-control': 'no-store' } })
    const delivered = await many('deliveries', (q) => q.eq('customer_id', customerId).eq('quotation_id', quotationId).eq('status', 'delivered').order('id'), 'id,number,delivery_date,destination')
    const live = delivered.length ? await many('invoice_delivery_notes', (q) => q.in('delivery_id', delivered.map((d) => d.id as number)).is('released_at', null), 'delivery_id,invoice_id') : []
    const invoiceOf = new Map(live.map((l) => [l.deliveryId as number, l.invoiceId as number]))
    const inv = live.length ? await many('invoices', (q) => q.in('id', [...new Set(live.map((l) => l.invoiceId as number))]), 'id,number') : []
    const number = new Map(inv.map((i) => [i.id as number, i.number as string]))
    const items = delivered.map((d) => {
      const billedOn = invoiceOf.get(d.id as number)
      return { id: d.id as number, number: d.number as string, date: (d.deliveryDate as string) ?? '', destination: (d.destination as string) ?? '', billedOn: billedOn ? { id: billedOn, number: number.get(billedOn) ?? '' } : null }
    })
    return Response.json({ quotation: { id: quotationId, number: quotation.number as string }, items }, { headers: { 'cache-control': 'no-store' } })
  } catch (e) {
    return errorResponse(e)
  }
}
