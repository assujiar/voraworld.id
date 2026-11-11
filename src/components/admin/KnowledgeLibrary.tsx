'use client'
import { useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'

type Entry = { id:number; title:string; category:string; status:string; revision:number; publishedRevision:number; attachment:string; updated:string }
const categories = ['company','services','operations','incoterms','customs','documentation','faq','other']

export function KnowledgeLibrary({ rows }: { rows: Entry[] }) {
  const [query,setQuery] = useState('')
  const [filter,setFilter] = useState('all')
  const [category,setCategory] = useState('other')
  const [locale,setLocale] = useState('en')
  const [file,setFile] = useState<File | null>(null)
  const [uploading,setUploading] = useState(false)
  const [error,setError] = useState('')
  const router = useRouter()
  const found = useMemo(() => rows.filter((r) => {
    const match = `${r.title} ${r.category} ${r.attachment}`.toLowerCase().includes(query.toLowerCase())
    return match && (filter === 'all' || r.status === filter || filter === 'pending' && r.status === 'published' && r.revision !== r.publishedRevision)
  }),[rows,query,filter])
  async function upload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!file || uploading) return
    setError(''); setUploading(true)
    try {
      const data = new FormData()
      data.set('file',file); data.set('locale',locale); data.set('category',category)
      const res = await fetch('/admin/api/agent-knowledge/import', { method:'POST',credentials:'same-origin', body:data })
      const responseText = await res.text()
      let json: {id?:number;error?:string;message?:string} = {}
      try { json = JSON.parse(responseText) } catch { json.error = responseText.slice(0, 240) }
      if (!res.ok || !json.id) throw new Error(json.error || json.message || 'Unable to import document')
      router.push(`/admin/agent-knowledge/${json.id}?notice=${encodeURIComponent('Document imported as draft. Review the extracted text before publishing.')}`)
      router.refresh()
    } catch (err) { setError(err instanceof Error ? err.message : 'Import failed') }
    finally { setUploading(false) }
  }
  const stats = [
    ['Total articles', rows.length], ['Published', rows.filter((r)=>r.status==='published').length],
    ['Draft / archived', rows.filter((r)=>r.status!=='published').length],
    ['Changes pending', rows.filter((r)=>r.status==='published' && r.revision!==r.publishedRevision).length],
  ]
  return <div className="kb-space">
    <div className="kb-overview">
      {stats.map(([label,value]) => <div className="kb-stat" key={label}><strong>{value}</strong><span>{label}</span></div>)}
    </div>
    <div className="kb-columns">
      <section className="admin-panel kb-library">
        <div className="kb-section-head"><div><h2>Knowledge articles</h2><p>Only published versions are used in customer conversations.</p></div><span className="kb-muted">{found.length} shown</span></div>
        <div className="kb-filters"><label className="kb-search"><span className="sr-only">Search articles</span><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search title, category or file" /></label>
          <select aria-label="Filter by publication status" value={filter} onChange={(e)=>setFilter(e.target.value)}><option value="all">All statuses</option><option value="published">Published</option><option value="draft">Draft</option><option value="pending">Unpublished changes</option><option value="archived">Archived</option></select>
        </div>
        <div className="kb-entries">
          {found.length ? found.map((r) => <a key={r.id} className="kb-entry" href={`/admin/agent-knowledge/${r.id}`}>
            <span className="kb-entry-mark">{r.attachment ? 'DOC' : 'KB'}</span>
            <span className="kb-entry-content"><strong>{r.title}</strong><small>{r.category} · {r.updated ? new Date(r.updated).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'Asia/Jakarta'}) : 'Unknown date'}{r.attachment ? ` · ${r.attachment}` : ''}</small></span>
            <span className={`kb-chip kb-chip--${r.status}`}>{r.revision !== r.publishedRevision && r.status === 'published' ? 'Pending changes' : r.status}</span><span aria-hidden>›</span>
          </a>) : <div className="kb-empty">No matching articles. Add a knowledge article or import an approved document.</div>}
        </div>
      </section>
      <aside className="kb-side">
        <section className="admin-panel kb-import"><span className="kb-kicker">DOCUMENT IMPORT</span><h2>Import from a file</h2><p>Upload a text-based PDF or DOCX. Extracted content becomes a draft for review, not an automatic publication.</p>
          <form onSubmit={upload}><div className="field"><label htmlFor="kb-file">Document (max 4 MB)</label><input id="kb-file" type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required onChange={(e)=>setFile(e.target.files?.[0]||null)} /></div>
            <div className="field"><label htmlFor="kb-locale">Source language</label><select id="kb-locale" value={locale} onChange={(e)=>setLocale(e.target.value)}><option value="en">English</option><option value="id">Bahasa Indonesia</option></select></div>
            <div className="field"><label htmlFor="kb-category">Category</label><select id="kb-category" value={category} onChange={(e)=>setCategory(e.target.value)}>{categories.map((c)=><option key={c} value={c}>{c}</option>)}</select></div>
            {error ? <p className="kb-error" role="alert">{error}</p> : null}<button type="submit" className="button" disabled={!file||uploading}>{uploading ? 'Extracting document…' : 'Import as draft'}</button>
          </form><p className="kb-hint">Scanned PDFs must be OCR-processed first. Original files are stored privately.</p>
        </section>
        <section className="admin-panel kb-import"><span className="kb-kicker">SOURCE PRIORITY</span><h2>What the agent reads</h2><ol><li>Published Admin knowledge</li><li>Public VORA FAQ and services</li><li>Built-in freight reference notes</li></ol><p>Changes are searchable immediately after publishing. No website redeploy needed.</p></section>
      </aside>
    </div>
  </div>
}
