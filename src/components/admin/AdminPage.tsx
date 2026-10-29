export interface Notices { notice?: string; error?: string }

/** Page heading, optional "+ New" button, and the success/error banners every admin screen shows. */
export function AdminPage({ heading, sp, newHref, newLabel, children }: { heading: string; sp?: Notices; newHref?: string; newLabel?: string; children: React.ReactNode }) {
  return (
    <>
      <div className="admin-top">
        <h1><small>VORA / BUSINESS CONTROL</small>{heading}</h1>
        <div className="inline-actions">{newHref ? <a className="button" href={newHref}>+ {newLabel}</a> : null}</div>
      </div>
      {sp?.notice ? <div className="alert" role="status">{sp.notice}</div> : null}
      {sp?.error ? <div className="alert" role="alert">{sp.error}</div> : null}
      {children}
    </>
  )
}

/** Where a failed submission returns to (validated server-side to local paths only). */
export const Back = ({ to }: { to: string }) => <input type="hidden" name="_back" value={to} />

export const fmt = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 16).replace('T', ' ') : '')
export const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : '')
