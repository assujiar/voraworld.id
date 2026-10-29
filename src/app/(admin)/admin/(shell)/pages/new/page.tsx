import { AdminPage, type Notices } from '@/components/admin/AdminPage'
import { PageForm } from '@/components/admin/PageForm'

export default async function NewPage({ searchParams }: { searchParams: Promise<Notices> }) {
  return <AdminPage heading="Page customizer" sp={await searchParams}><PageForm obj={null} sections={[]} revisions={[]} /></AdminPage>
}
