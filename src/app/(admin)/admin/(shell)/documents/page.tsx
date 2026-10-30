import { AdminPage, day, type Notices } from '@/components/admin/AdminPage'
import { DOCUMENT_TYPES, LANGS, LANGUAGE_NAMES } from '@/content/document-types'
import { sql } from '@/server/db'

const STATUSES = ['draft', 'issued', 'void']

export default async function Documents({ searchParams }: { searchParams: Promise<Notices & { q?: string; status?: string; kind?: string }> }) {
  const sp = await searchParams
  const q = (sp.q ?? '').trim().slice(0, 120)
  const status = STATUSES.includes(sp.status ?? '') ? sp.status! : ''
  const kind = DOCUMENT_TYPES.some((t) => t.key === sp.kind) ? sp.kind! : ''
  const like = '%' + q.replace(/[\\%_]/g, (c) => '\\' + c) + '%'
  const rows = await sql`select d.id, d.number, d.kind, d.language, d.status, d.subject, d.recipient, d.document_date, d.created_at
    from documents d
    where (${q} = '' or d.number ilike ${like} or d.subject ilike ${like} or d.recipient ilike ${like}) and (${status} = '' or d.status = ${status}) and (${kind} = '' or d.kind = ${kind})
    order by d.id desc limit 300`
  const customers = await sql`select id, name from customers order by name limit 500`
  return (
    <AdminPage heading="Letters & Certificates" sp={sp}>
      <div className="admin-panel">
        <h3>Write a new document</h3>
        <p className="note">Letters, billing letters, statements, powers of attorney, certification and assignment letters, and certificates. Each has its own layout, VORA letterhead, a number and a QR code that verifies it online. Choose the type and the language the document is written in.</p>
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
          <div className="field" style={{ alignSelf: 'end' }}><button className="button">Continue</button></div>
        </form>
        <ul className="mini muted" style={{ marginTop: 14 }}>
          {DOCUMENT_TYPES.map((t) => <li key={t.key}><strong>{t.label.en}</strong> ({t.label.id}): {t.summary.en}</li>)}
        </ul>
      </div>
      <div className="admin-panel">
        <form method="get" className="inline-actions" style={{ marginBottom: 14 }}>
          <input name="q" defaultValue={q} placeholder="Search number, subject or recipient" />
          <select name="kind" defaultValue={kind}><option value="">All types</option>{DOCUMENT_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label.en}</option>)}</select>
          <select name="status" defaultValue={status}><option value="">All status</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
          <button className="button">Filter</button>
        </form>
        <table><thead><tr><th>Document</th><th>Type</th><th>Subject</th><th>For</th><th>Date</th><th>Status</th></tr></thead><tbody>
          {rows.length ? rows.map((r) => {
            const t = DOCUMENT_TYPES.find((x) => x.key === r.kind)
            return (
              <tr key={r.id as number}>
                <td><a href={`/admin/documents/${r.id}`}>{r.number as string}</a></td>
                <td>{t?.label.en ?? (r.kind as string)} <small className="muted">· {(r.language as string).toUpperCase()}</small></td>
                <td>{r.subject as string}</td><td>{r.recipient as string}</td><td>{r.documentDate as string}</td>
                <td><span className="status">{r.status as string}</span></td>
              </tr>
            )
          }) : <tr><td colSpan={6}>No documents found.</td></tr>}
        </tbody></table>
        <p className="mini muted">Created {rows.length ? day(rows[0].createdAt as Date) : '-'} (latest).</p>
      </div>
    </AdminPage>
  )
}
