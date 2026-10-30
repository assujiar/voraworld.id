import { saveDocumentAction } from '@/actions/documents'
import { ActionForm, FCheckbox, FInput, FSelect, FTextarea, Submit } from '@/components/admin/ActionForm'
import { LANGUAGE_NAMES, type DocumentType, type Lang } from '@/content/document-types'
import { sql } from '@/server/db'
import { today } from '@/server/dates'
import { money } from '@/server/money'

export interface DocumentFormProps {
  type: DocumentType; lang: Lang
  /** Set when a draft is edited: its id, saved values and date. */
  record?: number; values?: Record<string, string>; documentDate?: string
  customerId: number | null
  /** Invoices a billing letter lists (when editing). */
  invoiceIds?: number[]
}

/** One form for every document type: the fields, their limits and their starting wording all come from the type. */
export async function DocumentForm({ type, lang, record, values, documentDate, customerId, invoiceIds }: DocumentFormProps) {
  const customers = type.family === 'billing' ? [] : await sql`select id, name from customers order by name limit 500`
  const open = type.family === 'billing' && customerId
    ? await sql`select id, number, due_at, currency, outstanding_minor from invoices where customer_id = ${customerId} and status in ('issued', 'partially_paid') and outstanding_minor > 0 order by issued_at, id limit 200`
    : []
  const current = (name: string, initial?: string) => values ? (values[name] ?? '') : (initial ?? '')
  return (
    <div className="admin-panel">
      <h3>{record ? 'Edit' : 'New'} · {type.label.en} <small className="muted">({type.label.id})</small></h3>
      <p className="note">Written in <strong>{LANGUAGE_NAMES[lang]}</strong>. {type.summary.en} Nothing is cut short: text that is too long is refused with a message.</p>
      <ActionForm action={saveDocumentAction}>
        {record ? <input type="hidden" name="record" value={record} /> : null}
        <input type="hidden" name="kind" value={type.key} />
        <input type="hidden" name="language" value={lang} />
        {type.family === 'billing' ? <input type="hidden" name="customer_id" value={customerId ?? ''} /> : null}
        <div className="admin-form-grid">
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
