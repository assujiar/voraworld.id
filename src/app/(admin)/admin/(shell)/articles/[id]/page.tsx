import { notFound } from 'next/navigation'
import { AdminPage, type Notices } from '@/components/admin/AdminPage'
import { ArticleForm } from '@/components/admin/ArticleForm'
import { sql } from '@/server/db'
import type { ArticlesRow } from '@/server/schema'

export default async function EditArticle({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Notices> }) {
  const id = Number((await params).id) || 0
  const [a] = await sql`select * from articles where id = ${id}`
  if (!a) notFound()
  const revisions = await sql`select id, created_at from revisions where resource = 'article' and resource_id = ${id} order by id desc limit 15`
  return <AdminPage heading="Article editor" sp={await searchParams}><ArticleForm obj={a as ArticlesRow} revisions={revisions as unknown as Array<{ id: number; createdAt: Date }>} /></AdminPage>
}
