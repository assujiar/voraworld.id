'use client'
import { useState } from 'react'

/**
 * Checks a file against the fingerprints VORA recorded. The file never leaves the browser: its SHA-256 is computed here and compared with the recorded ones. A match
 * means the file is byte for byte the one VORA recorded (or the original third-party file that was received before VORA's mark was added); anything else means it is not.
 * A match says nothing about who signed or who issued the original: the findings above say that, and only as far as the records go.
 */
export interface Recorded { sha256: string; kind: 'issued' | 'signed' | 'original'; version?: number }
type Result = { tone: 'ok' | 'info' | 'bad' | 'warn'; en: string; id: string }

export function FileCheck({ recorded }: { recorded: Recorded[] }) {
  const [result, setResult] = useState<Result | null>(null)
  const [busy, setBusy] = useState(false)
  const check = async (file: File | undefined) => {
    if (!file) return
    setBusy(true); setResult(null)
    try {
      if (!recorded.length) { setResult({ tone: 'warn', en: 'File integrity cannot currently be verified: no file is recorded for this document.', id: 'Keutuhan berkas saat ini tidak dapat diverifikasi: tidak ada berkas yang tercatat untuk dokumen ini.' }); return }
      const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
      const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
      const hit = recorded.find((r) => r.sha256 === hex)
      if (hit?.kind === 'original') setResult({ tone: 'info', en: 'This matches the original PDF received before VORA\'s signing or endorsement. It is not the file VORA issued.', id: 'Ini cocok dengan PDF asli yang diterima sebelum penandatanganan atau pengesahan oleh VORA. Ini bukan berkas yang diterbitkan VORA.' })
      else if (hit) {
        const latest = recorded.filter((r) => r.kind !== 'original').at(-1)
        const old = hit !== latest
        setResult({ tone: old ? 'warn' : 'ok',
          en: `This PDF matches the exact file recorded by VORA${hit.version ? ` (version ${hit.version}, ${hit.kind})` : ''}.${old ? ' A later version has since been recorded: check it for the current one.' : ''}`,
          id: `PDF ini cocok dengan berkas yang tepat sama dengan yang dicatat VORA${hit.version ? ` (versi ${hit.version}, ${hit.kind === 'signed' ? 'ditandatangani' : 'diterbitkan'})` : ''}.${old ? ' Versi yang lebih baru telah dicatat: periksa versi terbaru.' : ''}` })
      } else setResult({ tone: 'bad', en: 'This file does not match the registered document. It is not a file VORA recorded, or it has been changed since.', id: 'Berkas ini tidak cocok dengan dokumen yang terdaftar. Ini bukan berkas yang dicatat VORA, atau telah diubah sejak itu.' })
    } catch {
      setResult({ tone: 'warn', en: 'File integrity cannot currently be verified: the file could not be read here. Try again, or compare the fingerprint by hand.', id: 'Keutuhan berkas saat ini tidak dapat diverifikasi: berkas tidak dapat dibaca di sini. Coba lagi, atau bandingkan sidik jari secara manual.' })
    } finally { setBusy(false) }
  }
  return (
    <div className="vf-check">
      <label htmlFor="file-check"><strong>Check a PDF you hold <span className="vf-id">/ Periksa PDF yang Anda pegang</span></strong></label>
      <p className="vf-small">Choose the PDF. Its fingerprint is worked out on this device; the file is not uploaded. <span className="vf-id">Pilih PDF. Sidik jarinya dihitung di perangkat ini; berkas tidak diunggah.</span></p>
      <input id="file-check" type="file" accept="application/pdf,.pdf" onChange={(e) => void check(e.target.files?.[0])} />
      <div role="status" aria-live="polite" className="vf-result" data-tone={result?.tone ?? ''}>
        {busy ? 'Checking the file... / Memeriksa berkas...' : result ? <><strong>{result.tone === 'ok' ? '✓ ' : result.tone === 'bad' ? '✕ ' : '! '}{result.en}</strong><br /><span className="vf-id">{result.id}</span></> : null}
      </div>
      <p className="vf-small">A match shows the file is unchanged. It does not by itself prove who signed it or who issued an original. <span className="vf-id">Kecocokan menunjukkan berkas tidak berubah; ini tidak dengan sendirinya membuktikan siapa penandatangan atau penerbit dokumen asli.</span></p>
    </div>
  )
}
