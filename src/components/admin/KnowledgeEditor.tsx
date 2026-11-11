import { saveAgentKnowledge, changeAgentKnowledgeStatus, restoreAgentKnowledgeRevision } from '@/actions/agent-knowledge'
import { Back } from './AdminPage'
import { PendingForm } from '@/components/feedback/scope'
import { AsyncButton } from '@/components/feedback/AsyncButton'
import { KnowledgeTester, KnowledgeDelete } from './KnowledgeTester'
import { KNOWLEDGE_CATEGORIES } from '@/server/agent/knowledge-admin'

type Entry = {
  id:number; titleEn:string; titleId:string; bodyEn:string; bodyId:string; category:string; sourceUrl:string;
  status:string; revision:number; publishedRevision:number; attachmentName:string
}
type Revision = { id:number; revision:number; action:string; date:string }

export function KnowledgeEditor({ entry, history=[] }: { entry?: Entry; history?: Revision[] }) {
  const back = entry ? `/admin/agent-knowledge/${entry.id}` : '/admin/agent-knowledge/new'
  const isPublished = entry?.status === 'published'
  const changed = isPublished && entry?.revision !== entry?.publishedRevision
  return <div className="kb-editor-shell">
    <div className="kb-breadcrumb"><a href="/admin/agent-knowledge">Knowledge Base</a><span>›</span><span>{entry ? entry.titleEn || entry.titleId : 'New article'}</span></div>
    <div className="kb-editor-grid">
      <div className="admin-panel kb-editor">
        <div className="kb-section-head"><div><span className="kb-kicker">VORA VIRTUAL AGENT</span><h2>{entry ? 'Edit knowledge' : 'Create knowledge article'}</h2><p>Published content becomes available for retrieval on the next chat request.</p></div>
          {entry ? <span className={`kb-chip kb-chip--${entry.status}`}>{changed ? 'Pending changes' : entry.status}</span> : <span className="kb-chip kb-chip--draft">Draft</span>}
        </div>
        <PendingForm action={saveAgentKnowledge} id="knowledge-editor">
          <input type="hidden" name="record" value={entry?.id || ''} />
          <input type="hidden" name="revision" value={entry?.revision || 1} /><Back to={back}/>
          <div className="kb-fields-two"><div className="field"><label htmlFor="knowledge-category">Category</label><select id="knowledge-category" name="category" defaultValue={entry?.category || 'company'}>{KNOWLEDGE_CATEGORIES.map((c)=><option key={c} value={c}>{c[0].toUpperCase()+c.slice(1)}</option>)}</select></div>
          <div className="field"><label htmlFor="knowledge-source">Public reference URL (optional)</label><input id="knowledge-source" name="source_url" type="text" maxLength={500} defaultValue={entry?.sourceUrl||''} placeholder="https://... or /en/services/..."/></div></div>
          <div className="kb-language-grid">
            <section className="kb-language"><div className="kb-language-head"><strong>English</strong><span>EN</span></div>
              <div className="field"><label htmlFor="kb-title-en">Title</label><input id="kb-title-en" name="title_en" maxLength={200} defaultValue={entry?.titleEn||''} placeholder="e.g. Project Cargo Handling" /></div>
              <div className="field"><label htmlFor="kb-body-en">Approved information</label><textarea id="kb-body-en" name="body_en" maxLength={80000} rows={15} defaultValue={entry?.bodyEn||''} placeholder="Write verified facts, service boundaries, conditions and reference information. Avoid sensitive internal data." /></div>
            </section>
            <section className="kb-language"><div className="kb-language-head"><strong>Bahasa Indonesia</strong><span>ID</span></div>
              <div className="field"><label htmlFor="kb-title-id">Judul</label><input id="kb-title-id" name="title_id" maxLength={200} defaultValue={entry?.titleId||''} placeholder="Contoh: Penanganan Project Cargo" /></div>
              <div className="field"><label htmlFor="kb-body-id">Informasi yang disetujui</label><textarea id="kb-body-id" name="body_id" maxLength={80000} rows={15} defaultValue={entry?.bodyId||''} placeholder="Masukkan informasi terverifikasi, batas layanan dan hal yang perlu dikonfirmasi tim." /></div>
            </section>
          </div>
          <div className="kb-editor-footer"><p>At least one language is required. Saving an article that is already published will not change the live version until you select Publish.</p><AsyncButton className="button" type="submit">Save working draft</AsyncButton></div>
        </PendingForm>
        {entry ? <div className="kb-publishing">
          <h3>Publication controls</h3>
          <p>{changed ? 'A previous version remains live. Publish the saved changes after testing them.' : isPublished ? 'This version is available to website visitors.' : 'Only published articles appear in chat responses.'}</p>
          <div className="kb-publish-actions"><PendingForm action={changeAgentKnowledgeStatus}><input type="hidden" name="record" value={entry.id}/><input type="hidden" name="revision" value={entry.revision}/><input type="hidden" name="operation" value="publish"/><Back to={back}/><AsyncButton className="button" type="submit">{isPublished ? 'Publish saved version' : 'Publish article'}</AsyncButton></PendingForm>
          {isPublished ? <PendingForm action={changeAgentKnowledgeStatus}><input type="hidden" name="record" value={entry.id}/><input type="hidden" name="revision" value={entry.revision}/><input type="hidden" name="operation" value="unpublish"/><Back to={back}/><AsyncButton className="button-outline" type="submit">Unpublish</AsyncButton></PendingForm> : null}
          {entry.status !== 'archived' ? <PendingForm action={changeAgentKnowledgeStatus}><input type="hidden" name="record" value={entry.id}/><input type="hidden" name="revision" value={entry.revision}/><input type="hidden" name="operation" value="archive"/><Back to={back}/><AsyncButton className="button-outline" type="submit">Archive</AsyncButton></PendingForm> : <PendingForm action={changeAgentKnowledgeStatus}><input type="hidden" name="record" value={entry.id}/><input type="hidden" name="revision" value={entry.revision}/><input type="hidden" name="operation" value="restore"/><Back to={back}/><AsyncButton className="button-outline" type="submit">Restore draft</AsyncButton></PendingForm>}</div>
          <KnowledgeDelete id={entry.id} revision={entry.revision}/>
        </div> : null}
      </div>
      <aside className="kb-side">
        <KnowledgeTester />
        <section className="admin-panel kb-import"><span className="kb-kicker">EDITORIAL CHECKLIST</span><h2>Before publishing</h2><ul>
          <li>Confirm VORA-specific claims and scope</li><li>Remove confidential rates and customer details</li><li>Check customs, DG and Incoterms references</li><li>Test customer questions in EN and ID</li>
        </ul>
        <p>General logistics guidance must not be presented as a confirmed VORA service or booking.</p>
        {entry?.attachmentName ? <p><strong>Imported document:</strong> <a href={`/admin/api/agent-knowledge/${entry.id}/download`} download>{entry.attachmentName}</a></p> : null}
        </section>
        {entry && history.length ? <section className="admin-panel kb-import"><span className="kb-kicker">ARTICLE HISTORY</span><h2>Revisions</h2>
          <div className="kb-revisions">{history.map((h)=><div key={h.id} className="kb-revision"><div><strong>#{h.revision} · {h.action}</strong><small>{new Date(h.date).toLocaleString('en-GB',{timeZone:'Asia/Jakarta',dateStyle:'medium',timeStyle:'short'})} WIB</small></div>
            <PendingForm action={restoreAgentKnowledgeRevision}><input type="hidden" name="record" value={entry.id}/><input type="hidden" name="revision" value={entry.revision}/><input type="hidden" name="target_revision" value={h.revision}/><Back to={back}/><AsyncButton className="button-outline" type="submit">Restore</AsyncButton></PendingForm>
          </div>)}</div>
        </section> : null}
      </aside>
    </div>
  </div>
}
