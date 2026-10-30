'use client'
import { useEffect, useState } from 'react'

/**
 * The result of the last action, shown as a notice that stays out of the layout. Success and queued notices fade after a while; a failure stays
 * until it is closed.
 */
export function Notice({ notice, error }: { notice?: string; error?: string }) {
  const [open, setOpen] = useState({ notice: Boolean(notice), error: Boolean(error) })
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setOpen((o) => ({ ...o, notice: false })), 12_000)
    return () => clearTimeout(timer)
  }, [notice])
  const queued = notice ? /queued|antrean/i.test(notice) : false
  return (
    <div className="toasts">
      {notice && open.notice ? (
        <div className={`alert toast ${queued ? 'toast-queued' : 'toast-ok'}`} role="status">
          <span className="toast-mark" aria-hidden="true">{queued ? '…' : '✓'}</span><span>{notice}</span>
          <button type="button" className="toast-close" aria-label="Tutup pemberitahuan" onClick={() => setOpen((o) => ({ ...o, notice: false }))}>×</button>
        </div>
      ) : null}
      {error && open.error ? (
        <div className="alert toast toast-error" role="alert">
          <span className="toast-mark" aria-hidden="true">!</span><span>{error}</span>
          <button type="button" className="toast-close" aria-label="Tutup pesan kesalahan" onClick={() => setOpen((o) => ({ ...o, error: false }))}>×</button>
        </div>
      ) : null}
    </div>
  )
}
