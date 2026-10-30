'use client'
import { useState } from 'react'

/**
 * Checks a file against the fingerprints on the verification page. The file never leaves the browser: its SHA-256 is computed here and compared with the
 * ones the page shows. A match means the file is byte for byte the one VORA sealed (or the original that was sealed); anything else means it is not.
 */
export function FileCheck({ sealed, original }: { sealed: string; original: string }) {
  const [result, setResult] = useState<{ tone: 'ok' | 'info' | 'bad'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const check = async (file: File | undefined) => {
    if (!file) return
    setBusy(true); setResult(null)
    try {
      const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
      const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
      if (hex === sealed) setResult({ tone: 'ok', text: 'This file is exactly the document that VORA sealed. Its SHA-256 matches.' })
      else if (hex === original) setResult({ tone: 'info', text: 'This is the original file as it was before the seal was added, not the sealed copy. Its SHA-256 matches the original.' })
      else setResult({ tone: 'bad', text: 'This file does NOT match. It is not the document that VORA sealed, or it has been changed since.' })
    } catch {
      setResult({ tone: 'bad', text: 'The file could not be read here. Try again, or compare the fingerprint by hand.' })
    } finally { setBusy(false) }
  }
  return (
    <div className="note" style={{ marginTop: 18 }}>
      <label htmlFor="file-check"><strong>Check a file you hold</strong></label>
      <p className="mini muted" style={{ margin: '4px 0 8px' }}>Choose the PDF. It is read on this device only and is not uploaded.</p>
      <input id="file-check" type="file" accept="application/pdf,.pdf" style={{ maxWidth: "100%" }} onChange={(e) => void check(e.target.files?.[0])} />
      <div role="status" aria-live="polite" style={{ marginTop: 10 }}>
        {busy ? 'Checking the file...' : result ? <strong style={{ color: result.tone === 'bad' ? '#8c2f25' : result.tone === 'ok' ? '#276650' : undefined }}>{result.text}</strong> : null}
      </div>
    </div>
  )
}
