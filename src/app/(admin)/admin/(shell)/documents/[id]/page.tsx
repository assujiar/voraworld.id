import { notFound } from 'next/navigation'
import { documentStatusAction } from '@/actions/documents'
import { AdminPage, Back, fmt, type Notices } from '@/components/admin/AdminPage'
import { documentType, LANGUAGE_NAMES, longDate, type Lang } from '@/content/document-types'
import { one, withRelated } from '@/server/data'
import { publicBaseUrl } from '@/server/env'
import { routeId } from '@/server/http'
import { money } from '@/server/money'
import type { StoredFields } from '@/server/documents/general'
import { AsyncButton } from '@/components/feedback/AsyncButton'
import { PendingForm } from '@/components/feedback/scope'

export default async function DocumentDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Notices> }) {
  const id = routeId((await params).id)
  const found = id > 0 && id < 2_147_483_647 ? await one('documents', (q) => q.eq('id', id)) : undefined
  const [doc] = found ? await withRelated([found], 'customers', 'customerId', { name: 'customerName' }) : []
  const type = doc ? documentType(doc.kind as string) : undefined
  if (!doc || !type) notFound()
  const lang = doc.language as Lang
  const stored = doc.fields as StoredFields
  const status = doc.status as string
  const ver = await one('document_verification_tokens', (q) => q.eq('kind', 'document').eq('document_id', id).order('id'), 'token,revoked')
  const here = `/admin/documents/${id}`
  const shown = type.fields.filter((f) => stored.values[f.name])
  return (
    <AdminPage heading="Document" sp={await searchParams}>
      <div className="admin-panel">
        <h3>{doc.number as string} <span className="status">{status}</span></h3>
        <p><strong>{type.label.en}</strong> <small className="muted">({type.label[lang]})</small> · written in {LANGUAGE_NAMES[lang]} · dated {longDate(doc.documentDate as string, lang)}
          {doc.customerName ? <> · customer <a href={`/admin/customers/${doc.customerId}`}>{doc.customerName as string}</a></> : ' · a document of the company'}<br />
          Created {fmt(doc.createdAt as Date)}{doc.issuedAt ? ` · issued ${fmt(doc.issuedAt as Date)}` : ''}</p>
        {type.publicHolder ? <p className="note">The public verification page of a certificate names the holder ({stored.values.recipient_name}) and the title. Other documents show only their type, number, date and status.</p> : null}
        {type.family === 'seal' ? <p className="note">The public verification page names the document ({stored.values.source_title}), who issued it ({stored.values.source_issuer}) and the SHA-256 fingerprints. It shows nothing else about the file.</p> : null}
        <dl style={{ margin: '18px 0' }}>
          {shown.map((f) => (
            <div key={f.name} style={{ marginBottom: 10 }}>
              <dt className="mini muted">{f.label.en}</dt>
              <dd style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{f.input === 'date' ? longDate(stored.values[f.name], lang) : stored.values[f.name]}</dd>
            </div>
          ))}
        </dl>
        {stored.articles?.length ? (
          <div style={{ margin: '6px 0 18px' }}>
            <h4>Articles</h4>
            <ol style={{ paddingLeft: 20 }}>{stored.articles.map((a, i) => <li key={i} style={{ marginBottom: 8 }}><strong>{a.title}</strong><div style={{ whiteSpace: 'pre-wrap' }}>{a.body}</div></li>)}</ol>
          </div>
        ) : null}
        {type.family === 'seal' && stored.source ? (
          <div style={{ margin: '6px 0 18px' }}>
            <h4>The PDF and its seal</h4>
            <p className="mini">Original: {stored.source.name} · {stored.source.pages} page{stored.source.pages > 1 ? 's' : ''} · {(stored.source.bytes / 1024).toFixed(0)} KB<br />
              <span title="SHA-256 recorded when the file arrived">SHA-256 {stored.source.sha256}</span></p>
            {stored.seal ? <p className="mini">Sealed file: {stored.seal.pagesSealed} page{stored.seal.pagesSealed > 1 ? 's' : ''} carry the seal · made {fmt(new Date(stored.seal.sealedAt))}<br /><span title="SHA-256 of the sealed file; the verification page shows the same">SHA-256 {stored.seal.sha256}</span></p> : <p className="mini muted">Not sealed yet. The preview shows where the seal will go; issuing makes the sealed file and fixes its fingerprint.</p>}
            <a className="button-outline" href={`/admin/documents/${id}/source`} target="_blank" rel="noopener">Download the original ↗</a>
          </div>
        ) : null}
        {stored.invoices?.length ? (
          <table><thead><tr><th>Invoice</th><th>Issued</th><th>Due</th><th>Outstanding (when saved)</th></tr></thead><tbody>
            {stored.invoices.map((i) => <tr key={i.id}><td><a href={`/admin/invoices/${i.id}`}>{i.number}</a></td><td>{i.issuedAt}</td><td>{i.dueAt}</td><td>{money(i.outstandingMinor, i.currency)}</td></tr>)}
          </tbody></table>
        ) : null}
        {ver && !ver.revoked && status !== 'void' ? <p className="mini muted">Verification address (printed on the PDF as a QR code and a link): <a href={`/verify/${ver.token}`} target="_blank" rel="noopener">{publicBaseUrl()}/verify/{ver.token as string}</a></p> : null}
        <div className="inline-actions">
          {status === 'draft' ? <a className="button-outline" href={`/admin/documents/${id}/edit`}>Edit draft</a> : null}
          {status === 'draft' ? <PendingForm action={documentStatusAction}><input type="hidden" name="record" value={id} /><Back to={here} /><AsyncButton className="button" name="action" value="issue" busy={type.family === 'seal' ? 'Membubuhkan segel QR pada PDF…' : undefined}>Issue document</AsyncButton></PendingForm> : null}
          <a className="button-outline" href={`/admin/documents/${id}/pdf`} target="_blank" rel="noopener">{type.family === 'seal' ? (status === 'issued' ? 'Download the sealed PDF' : status === 'draft' ? 'Preview the seal (PDF)' : 'Sealed file withdrawn') : status === 'issued' ? 'Download PDF' : 'Download PDF (marked ' + status + ')'} ↗</a>
          {status !== 'void' ? <PendingForm action={documentStatusAction}><input type="hidden" name="record" value={id} /><Back to={here} /><AsyncButton className="button-outline" name="action" value="void">Void</AsyncButton></PendingForm> : null}
        </div>
        {status === 'draft' ? <p className="note mini">A draft is marked DRAFT on every page and its QR code shows DRAFT. Issuing freezes the document; to change an issued document, void it and write a new one.</p> : null}
      </div>
    </AdminPage>
  )
}
