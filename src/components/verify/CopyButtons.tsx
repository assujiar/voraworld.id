'use client'
import { useState } from 'react'

/** Copies the verification address or the document reference. No tracking, nothing sent anywhere: it only uses the clipboard. */
export function CopyButtons({ url, reference }: { url: string; reference: string }) {
  const [done, setDone] = useState('')
  const copy = async (what: 'url' | 'ref') => {
    const text = what === 'url' ? url : reference
    try { await navigator.clipboard.writeText(text) } catch {
      const t = document.createElement('textarea'); t.value = text; t.style.position = 'fixed'; t.style.opacity = '0'; document.body.appendChild(t); t.select()
      try { document.execCommand('copy') } finally { t.remove() }
    }
    setDone(what === 'url' ? 'Verification link copied | Tautan verifikasi disalin' : 'Document reference copied | Nomor dokumen disalin')
    setTimeout(() => setDone(''), 2500)
  }
  return (
    <div className="vf-actions">
      <button type="button" className="vf-btn" onClick={() => void copy('url')}>Copy verification link <span className="vf-id">| Salin tautan</span></button>
      <button type="button" className="vf-btn" onClick={() => void copy('ref')}>Copy document reference <span className="vf-id">| Salin nomor</span></button>
      <span role="status" aria-live="polite" className="vf-copied">{done}</span>
    </div>
  )
}
