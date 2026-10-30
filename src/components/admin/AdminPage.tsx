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
