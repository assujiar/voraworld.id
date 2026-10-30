'use client'
import { useId, useMemo, useState } from 'react'
import { useTypedList } from '@/components/admin/ActionForm'

/**
 * The editable table behind every list of lines: add a row, remove one, edit any cell, move a row up or down. Nobody types a `|` separator. The
 * cells are ordinary inputs named `item_<column>` (one value per row, in order), which the server reads back with `rowsFromForm`; a refused
 * submission brings the typed rows back. The amount column is only a convenience: the server recalculates every amount in exact decimal arithmetic.
 */
export interface Column { key: string; label: string; width?: string; type?: 'text' | 'number'; placeholder?: string; maxLength?: number; required?: boolean }
export type Row = Record<string, string>

/** Display only: quantity x price, the way the person would do it by hand. */
const preview = (q: string, p: string, currency: string): string => {
  const n = Number(q.replace(',', '.')) * Number(p.replace(',', '.'))
  if (!Number.isFinite(n) || q.trim() === '' || p.trim() === '') return ''
  try { return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: currency === 'IDR' || currency === 'JPY' ? 0 : 2 }).format(n) } catch { return n.toFixed(2) }
}

export function ItemsTable({ columns, initial, showAmount, currency = 'IDR', addLabel = 'Add row', minRows = 1 }: {
  columns: Column[]; initial: Row[]; showAmount?: boolean; currency?: string; addLabel?: string; minRows?: number
}) {
  const id = useId()
  const names = columns.map((c) => `item_${c.key}`)
  const typed = useTypedList(names[0])                                                        // rows the server sent back after refusing a submission
  const typedAll = columns.map((c) => useTypedList(`item_${c.key}`))                         // eslint-disable-line react-hooks/rules-of-hooks
  const seed = useMemo<Row[]>(() => {
    if (typed) return typed.map((_, i) => Object.fromEntries(columns.map((c, k) => [c.key, typedAll[k]?.[i] ?? ''])))
    return initial.length ? initial : Array.from({ length: minRows }, () => Object.fromEntries(columns.map((c) => [c.key, ''])))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const empty = () => Object.fromEntries(columns.map((c) => [c.key, c.key === 'unit' ? (showAmount ? 'unit' : 'pcs') : '']))
  const [rows, setRows] = useState<Array<Row & { _id: string }>>(() => seed.map((r, i) => ({ ...r, _id: `${id}-${i}` })))
  const [counter, setCounter] = useState(seed.length)
  const edit = (i: number, key: string, value: string) => setRows((rs) => rs.map((r, k) => (k === i ? { ...r, [key]: value } : r)))
  const remove = (i: number) => setRows((rs) => (rs.length > 1 ? rs.filter((_, k) => k !== i) : rs.map((r) => ({ ...r, ...Object.fromEntries(columns.map((c) => [c.key, ''])) }))))
  const move = (i: number, d: -1 | 1) => setRows((rs) => { const j = i + d; if (j < 0 || j >= rs.length) return rs; const c = [...rs]; [c[i], c[j]] = [c[j], c[i]]; return c })
  const add = () => { setRows((rs) => [...rs, { ...empty(), _id: `${id}-${counter}` }]); setCounter((n) => n + 1) }
  return (
    <div className="items-table">
      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead><tr>{columns.map((c) => <th key={c.key} style={{ width: c.width }}>{c.label}</th>)}{showAmount ? <th style={{ width: '14%' }}>Amount</th> : null}<th style={{ width: 130 }}>Action</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r._id}>
                {columns.map((c) => (
                  <td key={c.key}>
                    <input name={`item_${c.key}`} value={r[c.key] ?? ''} onChange={(e) => edit(i, c.key, e.target.value)} aria-label={`${c.label}, row ${i + 1}`}
                      inputMode={c.type === 'number' ? 'decimal' : undefined} placeholder={c.placeholder} maxLength={c.maxLength} style={{ width: '100%', minHeight: 40 }} />
                  </td>
                ))}
                {showAmount ? <td className="mini" aria-live="polite">{preview(r.quantity ?? '', r.price ?? '', currency) || '-'}</td> : null}
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button type="button" className="button-outline" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move row ${i + 1} up`} style={{ minHeight: 36, padding: '0 8px' }}>↑</button>{' '}
                  <button type="button" className="button-outline" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label={`Move row ${i + 1} down`} style={{ minHeight: 36, padding: '0 8px' }}>↓</button>{' '}
                  <button type="button" className="button-outline" onClick={() => remove(i)} aria-label={`Remove row ${i + 1}`} style={{ minHeight: 36, padding: '0 8px' }}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" className="button-outline" onClick={add} style={{ marginTop: 8, minHeight: 40 }}>{addLabel}</button>
      {showAmount ? <p className="mini muted" style={{ marginTop: 6 }}>The amount shown is only a preview. The server calculates every amount exactly when you save.</p> : null}
    </div>
  )
}

export const CHARGE_COLUMNS: Column[] = [
  { key: 'description', label: 'Description', width: '38%', maxLength: 500, placeholder: 'e.g. Ocean freight' },
  { key: 'quantity', label: 'Quantity', width: '10%', type: 'number', maxLength: 20, placeholder: '1' },
  { key: 'unit', label: 'Unit', width: '10%', maxLength: 30, placeholder: 'shipment' },
  { key: 'price', label: 'Unit price', width: '16%', type: 'number', maxLength: 30, placeholder: '2500000' },
]
export const CARGO_COLUMNS: Column[] = [
  { key: 'description', label: 'Cargo description', width: '42%', maxLength: 500, placeholder: 'e.g. Cartons of spare parts' },
  { key: 'quantity', label: 'Quantity', width: '12%', maxLength: 40, placeholder: '24' },
  { key: 'unit', label: 'Unit', width: '12%', maxLength: 30, placeholder: 'ctn' },
  { key: 'remarks', label: 'Remarks', width: '22%', maxLength: 240, placeholder: 'e.g. fragile' },
]
