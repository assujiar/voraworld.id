import { notFound } from 'next/navigation'
import { AdminPage, type Notices } from '@/components/admin/AdminPage'
import { KnowledgeEditor } from '@/components/admin/KnowledgeEditor'
import { many, one } from '@/server/data'
import { routeId } from '@/server/http'

export default async function EditKnowledge({ params, searchParams }: { params: Promise<{id:string}>; searchParams: Promise<Notices> }) {
  const id = routeId((await params).id)
  const entry = id > 0 ? await one('agent_knowledge', (q) => q.eq('id',id),
    'id,title_en,title_id,body_en,body_id,category,source_url,status,revision,published_revision,attachment_name,updated_at,published_at') : undefined
  if (!entry) notFound()
  const history = await many('agent_knowledge_revisions', (q) => q.eq('document_id', id).order('revision',{ascending:false}), 'id,revision,action,created_at', 12)
  return <AdminPage heading="Knowledge editor" sp={await searchParams}>
    <KnowledgeEditor entry={{
      id, titleEn: String(entry.titleEn || ''), titleId: String(entry.titleId || ''),
      bodyEn: String(entry.bodyEn || ''), bodyId: String(entry.bodyId || ''), category: String(entry.category),
      sourceUrl: String(entry.sourceUrl || ''), status: String(entry.status), revision: Number(entry.revision),
      publishedRevision: Number(entry.publishedRevision || 0), attachmentName: String(entry.attachmentName || ''),
    }} history={history.map((r) => ({ id: Number(r.id), revision: Number(r.revision), action: String(r.action),
      date: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt || '') }))}/>
  </AdminPage>
}
