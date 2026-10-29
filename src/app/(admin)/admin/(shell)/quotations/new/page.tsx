import { AdminPage, type Notices } from '@/components/admin/AdminPage'
import { QuotationForm } from '@/components/admin/QuotationForm'

export default async function NewQuotation({ searchParams }: { searchParams: Promise<Notices> }) {
  return <AdminPage heading="New quotation" sp={await searchParams}><QuotationForm /></AdminPage>
}
