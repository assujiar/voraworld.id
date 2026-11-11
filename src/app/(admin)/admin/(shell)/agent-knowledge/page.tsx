import { AdminPage, type Notices } from '@/components/admin/AdminPage'
import { many } from '@/server/data'
import { KnowledgeLibrary } from '@/components/admin/KnowledgeLibrary'

export default async function AgentKnowledge({ searchParams }: { searchParams: Promise<Notices> }) {
  const rows = await many('agent_knowledge', (q) => q.order('updated_at', { ascending: false }),
    'id,title_en,title_id,category,status,revision,published_revision,attachment_name,updated_at', 500)
  return <AdminPage heading="Agent Knowledge Base" sp={await searchParams} newHref="/admin/agent-knowledge/new" newLabel="New knowledge">
    <KnowledgeLibrary rows={rows.map((r) => ({
      id: Number(r.id), title: String(r.titleEn || r.titleId || 'Untitled'), category: String(r.category), status: String(r.status),
      revision: Number(r.revision), publishedRevision: Number(r.publishedRevision || 0),
      attachment: String(r.attachmentName || ''), updated: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : String(r.updatedAt || ''),
    }))} />
  </AdminPage>
}
