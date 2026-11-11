import { AdminPage, type Notices } from '@/components/admin/AdminPage'
import { KnowledgeEditor } from '@/components/admin/KnowledgeEditor'
export default async function NewKnowledge({ searchParams }: { searchParams: Promise<Notices> }) {
  return <AdminPage heading="New knowledge" sp={await searchParams}><KnowledgeEditor /></AdminPage>
}
