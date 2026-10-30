import { Suspense } from 'react'
import { Notice } from '@/components/feedback/Notice'
import { businessDateTime, today } from '@/server/dates'

export interface Notices { notice?: string; error?: string }

/** Page heading, optional "+ New" button, and the success/error banners every admin screen shows. */
export function AdminPage({ heading, sp, newHref, newLabel, children }: { heading: string; sp?: Notices; newHref?: string; newLabel?: string; children: React.ReactNode }) {
  return (
    <>
      <div className="admin-top">
        <h1>{heading}</h1>
        <div className="inline-actions">{newHref ? <a className="button" href={newHref}>+ {newLabel}</a> : null}</div>
      </div>
      {sp?.notice || sp?.error ? <Notice key={`${sp.notice ?? ""}|${sp.error ?? ""}`} notice={sp.notice} error={sp.error} /> : null}
      {children}
    </>
  )
}

/** Where a failed submission returns to (validated server-side to local paths only). */
export const Back = ({ to }: { to: string }) => <input type="hidden" name="_back" value={to} />

/** Times in the portal are shown on the Jakarta clock (WIB, UTC+7), the same day the documents carry. */
export const fmt = (d: Date | null | undefined) => (d ? businessDateTime(d) : '')
export const day = (d: Date | null | undefined) => (d ? today(d) : '')

/** Grey bars in the shape of a table while its rows are still being read. */
export function ListSkeleton({ what, columns = 5, rows = 6 }: { what: string; columns?: number; rows?: number }) {
  return (
    <div className="list-skeleton" role="status" aria-live="polite" aria-label={`Loading ${what}`}>
      <span className="sr-only">Loading {what}…</span>
      {Array.from({ length: rows }, (_, r) => (
        <div className="list-skeleton__row" key={r} style={{ gridTemplateColumns: `2fr ${'1fr '.repeat(columns - 1)}` }} aria-hidden="true">
          {Array.from({ length: columns }, (_, c) => <span className="skeleton" key={c} style={{ width: c === 0 ? '78%' : `${55 + ((r * 7 + c * 13) % 35)}%` }} />)}
        </div>
      ))}
    </div>
  )
}

/**
 * The rows of a list, behind a boundary that is renewed whenever the filters change: the heading, notices and filter form stay on screen and the
 * skeleton stands in for the table until the list arrives. Notices are not part of the key, so saving something does not flash a skeleton.
 */
export function ListLoad({ filters, what, columns, children }: { filters: Array<string | number | undefined>; what: string; columns?: number; children: React.ReactNode }) {
  return <Suspense key={filters.join('|')} fallback={<ListSkeleton what={what} columns={columns} />}>{children}</Suspense>
}
