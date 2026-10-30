import { notFound } from 'next/navigation'
import { AdminPage, type Notices } from '@/components/admin/AdminPage'
import { DeliveryForm } from '@/components/admin/DeliveryForm'
import { deliveryBy } from '@/server/delivery/deliveries'
import { routeId } from '@/server/http'

export default async function EditDelivery({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Notices> }) {
  const id = routeId((await params).id)
  const d = id > 0 && id < 2_147_483_647 ? await deliveryBy('id', id) : null
  if (!d) notFound()
  return (
    <AdminPage heading={`Edit ${d.number}`} sp={await searchParams}>
      {d.status !== 'draft'
        ? <div className="admin-panel"><p>Only a draft can be edited. <a href={`/admin/deliveries/${id}`}>Back to the delivery note</a></p></div>
        : <DeliveryForm delivery={d} />}
    </AdminPage>
  )
}
