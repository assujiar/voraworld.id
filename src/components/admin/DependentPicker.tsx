'use client'
import { useEffect, useState } from 'react'
import { AsyncButton } from '@/components/feedback/AsyncButton'

interface Customer { id: number; name: string; code: string }
interface QuotationOption { id: number; label: string }
interface DeliveryOption { id: number; number: string; date: string; destination: string; billedOn: { id: number; number: string } | null }
type Load<T> = { state: 'idle' } | { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; items: T[] }

/** Fetches `url`, drops the answer when a newer request was made meanwhile (the last choice always wins), and reports failures in words. */
function useLoad<T>(url: string | null): [Load<T>, () => void] {
  const [result, setResult] = useState<Load<T>>({ state: 'idle' })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!url) { setResult({ state: 'idle' }); return }
    const abort = new AbortController()
    setResult({ state: 'loading' })
    fetch(url, { signal: abort.signal, headers: { accept: 'application/json' } })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(typeof body.error === 'string' ? body.error : res.status === 401 ? 'Your session has ended. Sign in again.' : 'The list could not be loaded.')
        setResult({ state: 'ready', items: body.items as T[] })
      })
      .catch((e) => { if (!abort.signal.aborted) setResult({ state: 'error', message: e instanceof Error ? e.message : 'The list could not be loaded.' }) })
    return () => abort.abort()
  }, [url, attempt])
  return [result, () => setAttempt((n) => n + 1)]
}

/**
 * Customer, then one of their validated quotations, then (for an invoice) the delivery notes to bill, all on one screen. Each list is read when the choice
 * above it is made, says that it is loading, and says why when it is empty. It lives inside a StepForm, so Continue opens the prefilled form.
 */
export function DependentPicker({ mode, customers }: { mode: 'delivery' | 'invoice'; customers: Customer[] }) {
  const [customer, setCustomer] = useState('')
  const [quotation, setQuotation] = useState('')
  const [picked, setPicked] = useState<number[]>([])
  const [quotations, retryQuotations] = useLoad<QuotationOption>(customer ? `/admin/api/pickers/quotations?customer=${customer}` : null)
  const [deliveries, retryDeliveries] = useLoad<DeliveryOption>(mode === 'invoice' && customer && quotation ? `/admin/api/pickers/deliveries?customer=${customer}&quotation=${quotation}` : null)
  const name = customers.find((c) => String(c.id) === customer)?.name ?? ''

  useEffect(() => { if (quotations.state === 'ready' && !quotations.items.some((q) => String(q.id) === quotation)) setQuotation('') }, [quotations, quotation])
  useEffect(() => { if (deliveries.state === 'ready') setPicked(deliveries.items.filter((d) => !d.billedOn).map((d) => d.id)); else setPicked([]) }, [deliveries])

  const noun = mode === 'delivery' ? 'a delivery note' : 'an invoice'
  const ready = Boolean(customer && quotation) && (mode === 'delivery' || picked.length > 0)

  return (
    <>
      <div className="field wide"><label htmlFor="pick-customer">Customer</label>
        <select id="pick-customer" name="customer" required value={customer} onChange={(e) => { setCustomer(e.target.value); setQuotation('') }}>
          <option value="" disabled>Choose a customer</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.code || 'legacy'}</option>)}
        </select>
      </div>

      <div className="field wide" aria-live="polite"><label htmlFor="pick-quotation">Validated quotation</label>
        <select id="pick-quotation" name="quotation" required value={quotation} onChange={(e) => setQuotation(e.target.value)} disabled={quotations.state !== 'ready' || quotations.items.length === 0} aria-busy={quotations.state === 'loading'}>
          <option value="" disabled>
            {!customer ? 'Choose a customer first' : quotations.state === 'loading' ? `Loading the quotations of ${name}…` : quotations.state === 'error' ? 'Could not load the quotations' : quotations.state === 'ready' && quotations.items.length === 0 ? 'No validated quotation' : 'Choose a quotation'}
          </option>
          {quotations.state === 'ready' ? quotations.items.map((q) => <option key={q.id} value={q.id}>{q.label}</option>) : null}
        </select>
        {quotations.state === 'loading' ? <p className="mini muted"><span className="spin" aria-hidden="true" /> Loading the quotations of {name}…</p> : null}
        {quotations.state === 'error' ? <p className="mini" role="alert">{quotations.message} <button type="button" className="button-outline" onClick={retryQuotations}>Try again</button></p> : null}
        {quotations.state === 'ready' && quotations.items.length === 0 ? (
          <p className="note">{name} has no validated quotation, so {noun} cannot be made yet. A quotation becomes validated after the customer has signed it and VORA has checked it. <a href={`/admin/customers/${customer}`}>Open the customer</a></p>
        ) : null}
      </div>

      {mode === 'invoice' && quotation ? (
        <div className="field wide" aria-live="polite"><label>Delivery notes to bill</label>
          {deliveries.state === 'loading' ? <p className="mini muted"><span className="spin" aria-hidden="true" /> Loading the delivery notes of this quotation…</p> : null}
          {deliveries.state === 'error' ? <p className="mini" role="alert">{deliveries.message} <button type="button" className="button-outline" onClick={retryDeliveries}>Try again</button></p> : null}
          {deliveries.state === 'ready' && deliveries.items.length === 0 ? (
            <p className="note">This quotation has no delivery note with a recorded proof of delivery yet. Only delivered notes can be billed. <a href={`/admin/deliveries/new?customer=${customer}&quotation=${quotation}`}>Make a delivery note</a></p>
          ) : null}
          {deliveries.state === 'ready' && deliveries.items.length > 0 ? (
            <table><thead><tr><th></th><th>Delivery note</th><th>Date</th><th>Destination</th><th>Billing</th></tr></thead><tbody>
              {deliveries.items.map((d) => (
                <tr key={d.id}>
                  <td><input type="checkbox" name="delivery" value={d.id} disabled={Boolean(d.billedOn)} checked={picked.includes(d.id)} onChange={(e) => setPicked((p) => e.target.checked ? [...p, d.id] : p.filter((x) => x !== d.id))} aria-label={`Bill ${d.number}`} style={{ width: 'auto', minHeight: 0 }} /></td>
                  <td><a href={`/admin/deliveries/${d.id}`}>{d.number}</a></td><td>{d.date}</td><td>{d.destination}</td>
                  <td>{d.billedOn ? <>already on <a href={`/admin/invoices/${d.billedOn.id}`}>{d.billedOn.number}</a></> : 'not billed yet'}</td>
                </tr>
              ))}
            </tbody></table>
          ) : null}
        </div>
      ) : null}

      <div className="field"><AsyncButton className="button" disabled={!ready} busy={mode === 'delivery' ? 'Memuat form Surat Jalan…' : 'Menyiapkan form Invoice…'}>Continue</AsyncButton></div>
    </>
  )
}
