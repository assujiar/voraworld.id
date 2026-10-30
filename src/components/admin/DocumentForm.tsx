import { saveDocumentAction } from '@/actions/documents'
import { ActionForm, FCheckbox, FInput, FSelect, FTextarea, Submit } from '@/components/admin/ActionForm'
import { ARTICLE_COLUMNS, ItemsTable } from '@/components/admin/ItemsTable'
import { LANGUAGE_NAMES, type Article, type DocumentType, type Lang } from '@/content/document-types'
import { many } from '@/server/data'
import { today } from '@/server/dates'
import { money } from '@/server/money'

export interface DocumentFormProps {
  type: DocumentType; lang: Lang
  /** Set when a draft is edited: its id, saved values and date. */
  record?: number; values?: Record<string, string>; documentDate?: string
  customerId: number | null
  /** Invoices a billing letter lists (when editing). */
  invoiceIds?: number[]
  /** The articles of an agreement being edited; a new agreement starts from the type's template. */
  articles?: Article[]
  /** The PDF already stored for a seal document being edited. */
  sourceName?: string
}

/** One form for every document type: the fields, their limits and their starting wording all come from the type. */
export async function DocumentForm({ type, lang, record, values, documentDate, customerId, invoiceIds, articles, sourceName }: DocumentFormProps) {
  const customers = type.family === 'billing' ? [] : await many('customers', (q) => q.order('name'), 'id,name', 500)
  const open = type.family === 'billing' && customerId
    ? await many('invoices', (q) => q.eq('customer_id', customerId).in('status', ['issued', 'partially_paid']).gt('outstanding_minor', 0).order('issued_at').order('id'), 'id,number,due_at,currency,outstanding_minor', 200)
    : []
  const current = (name: string, initial?: string) => values ? (values[name] ?? '') : (initial ?? '')
  return (
    <div className="admin-panel">
      <h3>{record ? 'Edit' : 'New'} · {type.label.en} <small className="muted">({type.label.id})</small></h3>
      <p className="note">Written in <strong>{LANGUAGE_NAMES[lang]}</strong>. {type.summary.en} Nothing is cut short: text that is too long is refused with a message.</p>
      {type.family === 'agreement' ? <p className="note">The articles below are a starting template, not legal advice. Complete every <strong>[{lang === 'id' ? 'isi' : 'fill in'}: ...]</strong> part, adapt the wording to the deal and have the agreement reviewed before it is signed. An agreement cannot be issued while a bracket is left in it.</p> : null}
      {type.family === 'seal' ? <p className="note"><strong>How the seal works.</strong> A QR code with the signatory&apos;s name is added to a PDF that another party issued. Anyone who scans it sees that VORA endorsed the file and its SHA-256 fingerprint, so a changed file can be recognised. A PDF that already carries a cryptographic signature is refused, because adding a seal would break that signature.</p> : null}
      <ActionForm action={saveDocumentAction}>
        {record ? <input type="hidden" name="record" value={record} /> : null}
        <input type="hidden" name="kind" value={type.key} />
        <input type="hidden" name="language" value={lang} />
        {type.family === 'billing' ? <input type="hidden" name="customer_id" value={customerId ?? ''} /> : null}
        <div className="admin-form-grid">
          {type.family === 'seal' ? (
            <div className="field wide"><label>PDF to seal {record ? '(leave empty to keep the stored file)' : '*'}</label>
              <input type="file" name="source_pdf" accept="application/pdf,.pdf" required={!record} />
              <span className="mini muted">{sourceName ? `Stored now: ${sourceName}. ` : ''}A readable PDF without a password and without a digital signature of its own. Uploading and checking can take a moment.</span>
            </div>
          ) : null}
          <div className="field"><label>Document date</label><FInput name="document_date" type="date" fallback={documentDate ?? today()} required /></div>
          {type.family !== 'billing' ? (
            <div className="field"><label>Customer (optional)</label>
              <FSelect name="customer_id" fallback={customerId ? String(customerId) : ''}>
                <option value="">None: a document of the company</option>
                {customers.map((c) => <option key={c.id as number} value={c.id as number}>{c.name as string}</option>)}
              </FSelect>
              <span className="mini muted">Numbered under the customer&apos;s code; a letter to a customer starts from their name and address.</span>
            </div>
          ) : null}
          {type.fields.map((f) => (
            <div key={f.name} style={{ display: 'contents' }}>
              {f.section ? <h4 className="wide" style={{ gridColumn: '1 / -1', margin: '14px 0 0' }}>{f.section.en} <small className="muted">{f.section[lang] !== f.section.en ? `(${f.section[lang]})` : ''}</small></h4> : null}
              <div className={`field${f.input === 'textarea' ? ' wide' : ''}`}>
                <label>{f.label.en}{f.required ? ' *' : ''} {lang === 'id' && f.label.id !== f.label.en ? <small className="muted">· {f.label.id}</small> : null}</label>
                {f.input === 'textarea'
                  ? <FTextarea name={f.name} rows={f.rows ?? 4} fallback={current(f.name, f.initial?.[lang])} placeholder={f.placeholder?.[lang]} />
                  : f.input === 'select'
                    ? <FSelect name={f.name} fallback={current(f.name, f.initial?.[lang] ?? f.options?.[0]?.value)}>{f.options?.map((o) => <option key={o.value} value={o.value}>{o.label.en} ({o.label[lang]})</option>)}</FSelect>
                    : <FInput name={f.name} type={f.input === 'date' ? 'date' : 'text'} fallback={current(f.name, f.initial?.[lang])} placeholder={f.placeholder?.[lang]} />}
                {f.hint ? <span className="mini muted">{f.hint.en}</span> : null}
              </div>
            </div>
          ))}
          {type.family === 'agreement' ? (
            <div className="field wide">
              <h4 style={{ margin: '14px 0 6px' }}>Articles (Pasal)</h4>
              <ItemsTable columns={ARTICLE_COLUMNS} initial={(articles ?? type.articles?.[lang] ?? []).map((a) => ({ title: a.title, body: a.body }))} addLabel="Add article" />
              <span className="mini muted">Numbered automatically as Pasal / Article 1, 2, 3 in the order shown. Use the arrows to move an article. Up to 40 articles of 3,000 characters each.</span>
            </div>
          ) : null}
          {type.family === 'billing' ? (
            <div className="field wide">
              <label>Invoices to bill *</label>
              {open.length ? open.map((i) => (
                <label key={i.id as number} style={{ display: 'block', fontWeight: 400 }}>
                  <FCheckbox name="invoice_ids" value={String(i.id)} fallbackChecked={invoiceIds ? invoiceIds.includes(i.id as number) : true} style={{ width: 'auto', minHeight: 0, marginRight: 8 }} />
                  {i.number as string} · due {i.dueAt as string} · outstanding {money(i.outstandingMinor as number, i.currency as string)}
                </label>
              )) : <p className="note">This customer has no open invoice to bill.</p>}
              <span className="mini muted">The letter lists these invoices with what is still outstanding, as it stands when you save and again when you issue the letter. Choose invoices in one currency.</span>
            </div>
          ) : null}
        </div>
        <Submit>{record ? 'Save draft' : 'Save draft'}</Submit>
      </ActionForm>
    </div>
  )
}
