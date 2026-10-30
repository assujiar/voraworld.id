import { many, one } from '@/server/data'
import { requireUser } from '@/server/auth/guard'
import { errorResponse } from '@/server/http'
import { money } from '@/server/money'

const id = (v: string | null) => (/^\d{1,10}$/.test(v ?? '') && Number(v) <= 2_147_483_647 ? Number(v) : 0)

/** The validated quotations of one customer, for the picker on the delivery note and invoice screens. */
export async function GET(request: Request) {
  try {
    await requireUser(request)
    const customerId = id(new URL(request.url).searchParams.get('customer'))
    const customer = customerId ? await one('customers', (q) => q.eq('id', customerId), 'id,name') : undefined
    if (!customer) return Response.json({ error: 'That customer does not exist.' }, { status: 404, headers: { 'cache-control': 'no-store' } })
    const rows = await many('quotations', (q) => q.eq('customer_id', customerId).eq('status', 'validated').order('id', { ascending: false }), 'id,number,total_minor,currency,origin,destination', 100)
    const items = rows.map((r) => ({ id: r.id as number, label: `${r.number as string} · ${money(r.totalMinor as number, r.currency as string)}${r.origin ? ` · ${r.origin as string} → ${r.destination as string}` : ''}` }))
    return Response.json({ customer: { id: customerId, name: customer.name as string }, items }, { headers: { 'cache-control': 'no-store' } })
  } catch (e) {
    return errorResponse(e)
  }
}
