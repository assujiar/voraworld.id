import { AdminPage, type Notices } from '@/components/admin/AdminPage'
import { CustomerForm } from '@/components/admin/CustomerForm'

export default async function NewCustomer({ searchParams }: { searchParams: Promise<Notices> }) {
  return <AdminPage heading="New customer" sp={await searchParams}><CustomerForm /></AdminPage>
}
