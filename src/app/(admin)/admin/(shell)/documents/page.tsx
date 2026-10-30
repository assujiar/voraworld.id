import { AdminPage, ListLoad, day, type Notices } from '@/components/admin/AdminPage'
import { DOCUMENT_TYPES, LANGS, LANGUAGE_NAMES } from '@/content/document-types'
import { many, searchClause } from '@/server/data'
import { AsyncButton } from '@/components/feedback/AsyncButton'
import { StepForm } from '@/components/feedback/StepForm'
import { DOCUMENT_LABEL, label } from '@/server/finance/labels'

const STATUSES = ['draft', 'issued', 'void']

export default async function Documents({ searchParams }: { searchParams: Promise<Notices & { q?: string; status?: string; kind?: string }> }) {
  const sp = await searchParams
  const q = (sp.q ?? '').trim().slice(0, 120)
  const status = STATUSES.includes(sp.status ?? '') ? sp.status! : ''
  const kind = DOCUMENT_TYPES.some((t) => t.key === sp.kind) ? sp.kind! : ''
  const customers = await many('customers', (f) => f.order('name'), 'id,name', 500)
  return (
    <AdminPage heading="Documents, Letters & Agreements" sp={sp}>
      <div className="admin-panel">
        <h3>Write a new document</h3>
        <p className="note">Letters, billing letters, statements, powers of attorney, certification and assignment letters, agreements (perjanjian), certificates, and a QR seal for PDFs that another party issued. Each has its own layout, VORA letterhead, a number and a QR code that verifies it online. Choose the type and the language the document is written in.</p>
        <form method="get" action="/admin/documents/new" className="admin-form-grid">
          <div className="field"><label>Type</label>
            <select name="type" required>{DOCUMENT_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label.en} · {t.label.id}</option>)}</select>
          </div>
          <div className="field"><label>Language of the document</label>
            <select name="lang" defaultValue="id">{LANGS.map((l) => <option key={l} value={l}>{LANGUAGE_NAMES[l]}</option>)}</select>
          </div>
          <div className="field"><label>Customer (needed for a billing letter)</label>
            <select name="customer" defaultValue=""><option value="">None</option>{customers.map((c) => <option key={c.id as number} value={c.id as number}>{c.name as string}</option>)}</select>
          </div>
          <div className="field" style={{ alignSelf: 'end' }}><AsyncButton className="button">Continue</AsyncButton></div>
        </form>
        <ul className="mini muted" style={{ marginTop: 14 }}>
          {DOCUMENT_TYPES.map((t) => <li key={t.key}><strong>{t.label.en}</strong> ({t.label.id}): {t.summary.en}</li>)}
        </ul>
      </div>
      <div className="admin-panel">
        <StepForm className="inline-actions" style={{ marginBottom: 14 }}>
          <input name="q" defaultValue={q} placeholder="Search number, subject or recipient" />
          <select name="kind" defaultValue={kind}><option value="">All types</option>{DOCUMENT_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label.en}</option>)}</select>
          <select name="status" defaultValue={status}><option value="">All status</option>{STATUSES.map((s) => <option key={s} value={s}>{label(DOCUMENT_LABEL, s)}</option>)}</select>
          <AsyncButton className="button">Filter</AsyncButton>
        </StepForm>
        <ListLoad filters={[q, status, kind]} what="documents" columns={6}><DocumentRows q={q} status={status} kind={kind} /></ListLoad>
      </div>
    </AdminPage>
  )
}

async function DocumentRows({ q, status, kind }: { q: string; status: string; kind: string }) {
  const clause = await searchClause(q, ['number', 'subject', 'recipient'])
  const rows = await many('documents', (f) => {
    let b = clause ? f.or(clause) : f
    if (status) b = b.eq('status', status)
    if (kind) b = b.eq('kind', kind)
    return b.order('id', { ascending: false })
  }, 'id,number,kind,language,status,subject,recipient,document_date,created_at', 300)
  return (
    <>
        <table><thead><tr><th>Document</th><th>Type</th><th>Subject</th><th>For</th><th>Date</th><th>Status</th></tr></thead><tbody>
          {rows.length ? rows.map((r) => {
            const t = DOCUMENT_TYPES.find((x) => x.key === r.kind)
            return (
              <tr key={r.id as number}>
                <td><a href={`/admin/documents/${r.id}`}>{r.number as string}</a></td>
                <td>{t?.label.en ?? (r.kind as string)} <small className="muted">· {(r.language as string).toUpperCase()}</small></td>
                <td>{r.subject as string}</td><td>{r.recipient as string}</td><td>{r.documentDate as string}</td>
                <td><span className="status">{label(DOCUMENT_LABEL, r.status)}</span></td>
              </tr>
            )
          }) : <tr><td colSpan={6}>No documents found.</td></tr>}
        </tbody></table>
        <p className="mini muted">Created {rows.length ? day(rows[0].createdAt as Date) : '-'} (latest).</p>
    </>
  )
}
