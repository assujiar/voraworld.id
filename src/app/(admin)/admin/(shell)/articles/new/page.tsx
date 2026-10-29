import { AdminPage, type Notices } from '@/components/admin/AdminPage'
import { ArticleForm } from '@/components/admin/ArticleForm'

export default async function NewArticle({ searchParams }: { searchParams: Promise<Notices> }) {
  return <AdminPage heading="Article editor" sp={await searchParams}><ArticleForm obj={null} revisions={[]} /></AdminPage>
}
