import { notFound } from 'next/navigation'
import { AdminPage, type Notices } from '@/components/admin/AdminPage'
import { PageForm } from '@/components/admin/PageForm'
import { sql } from '@/server/db'
import type { PagesRow, SectionsRow } from '@/server/schema'
import { routeId } from '@/server/http'

export default async function EditPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Notices> }) {
  const id = routeId((await params).id)
  const [p] = await sql`select * from pages where id = ${id}`
  if (!p) notFound()
  const [sections, revisions] = await Promise.all([
    sql`select * from sections where page_id = ${id} order by position, id`,
    sql`select id, created_at from revisions where resource = 'page' and resource_id = ${id} order by id desc limit 12`,
  ])
  return <AdminPage heading="Page customizer" sp={await searchParams}><PageForm obj={p as PagesRow} sections={sections as unknown as SectionsRow[]} revisions={revisions as unknown as Array<{ id: number; createdAt: Date }>} /></AdminPage>
}
