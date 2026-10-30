import { notFound } from 'next/navigation'
import { AdminPage, type Notices } from '@/components/admin/AdminPage'
import { ArticleForm } from '@/components/admin/ArticleForm'
import { many, one } from '@/server/data'
import type { ArticlesRow } from '@/server/schema'
import { routeId } from '@/server/http'

export default async function EditArticle({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Notices> }) {
  const id = routeId((await params).id)
  const a = id > 0 ? await one('articles', (q) => q.eq('id', id)) : undefined
  if (!a) notFound()
  const revisions = await many('revisions', (q) => q.eq('resource', 'article').eq('resource_id', id).order('id', { ascending: false }), 'id,created_at', 15)
  return <AdminPage heading="Article editor" sp={await searchParams}><ArticleForm obj={a as unknown as ArticlesRow} revisions={revisions as unknown as Array<{ id: number; createdAt: Date }>} /></AdminPage>
}
