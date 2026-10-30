import { notFound } from 'next/navigation'
import { AdminPage, type Notices } from '@/components/admin/AdminPage'
import { PageForm } from '@/components/admin/PageForm'
import { many, one } from '@/server/data'
import type { PagesRow, SectionsRow } from '@/server/schema'
import { routeId } from '@/server/http'

export default async function EditPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Notices> }) {
  const id = routeId((await params).id)
  const p = id > 0 ? await one('pages', (q) => q.eq('id', id)) : undefined
  if (!p) notFound()
  const [sections, revisions] = await Promise.all([
    many('sections', (q) => q.eq('page_id', id).order('position').order('id')),
    many('revisions', (q) => q.eq('resource', 'page').eq('resource_id', id).order('id', { ascending: false }), 'id,created_at', 12),
  ])
  return <AdminPage heading="Page customizer" sp={await searchParams}><PageForm obj={p as unknown as PagesRow} sections={sections as unknown as SectionsRow[]} revisions={revisions as unknown as Array<{ id: number; createdAt: Date }>} /></AdminPage>
}
