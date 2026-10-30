import { AdminPage, type Notices } from '@/components/admin/AdminPage'
import { DeliveryForm } from '@/components/admin/DeliveryForm'

export default async function NewDelivery({ searchParams }: { searchParams: Promise<Notices> }) {
  return <AdminPage heading="New delivery note" sp={await searchParams}><DeliveryForm /></AdminPage>
}
