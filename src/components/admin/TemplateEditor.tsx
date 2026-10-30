'use client'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AsyncButton } from '@/components/feedback/AsyncButton'
import { PendingForm } from '@/components/feedback/scope'

type Action = (form: FormData) => Promise<void>
type Preview = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; subject: string; html: string; unknown: string[] }

/**
 * One email template: subject, HTML, the variables it can use (click to put one at the cursor), a preview made by the server with the same sanitiser as
 * the real message, and two buttons: save, and send an example to the administrator address. The preview says when it is loading and when it failed,
 * and a late answer for older text never replaces a newer one.
 */
export function TemplateEditor({ name, keyName, subject: initialSubject, html: initialHtml, variables, save, test, back }: {
  name: string; keyName: string; subject: string; html: string; variables: string[]; save: Action; test: Action; back: ReactNode
}) {
  const [subject, setSubject] = useState(initialSubject)
  const [html, setHtml] = useState(initialHtml)
  const [preview, setPreview] = useState<Preview>({ state: 'loading' })
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const area = useRef<HTMLTextAreaElement>(null)
  const dirty = subject !== initialSubject || html !== initialHtml

  // Thirteen templates sit in closed panels: only the open one is previewed, so nothing is requested or drawn for the others.
  useEffect(() => {
    const details = root.current?.closest('details')
    if (!details) { setOpen(true); return }
    const sync = () => setOpen(details.open)
    sync()
    details.addEventListener('toggle', sync)
    return () => details.removeEventListener('toggle', sync)
  }, [])

  useEffect(() => {
    if (!open) return
    const abort = new AbortController()
    setPreview({ state: 'loading' })
    const timer = setTimeout(() => {
      fetch('/admin/api/mail/preview', { method: 'POST', signal: abort.signal, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ subject, html }) })
        .then(async (res) => {
          if (!res.ok) throw new Error(res.status === 401 ? 'Sesi Anda sudah berakhir. Masuk lagi untuk melihat pratinjau.' : 'Pratinjau tidak bisa dibuat.')
          const body = await res.json()
          setPreview({ state: 'ready', subject: body.subject, html: body.html, unknown: body.unknown ?? [] })
        })
        .catch((e) => { if (!abort.signal.aborted) setPreview({ state: 'error', message: e instanceof Error ? e.message : 'Pratinjau tidak bisa dibuat.' }) })
    }, 350)                                                               // typing does not ask the server once per key
    return () => { clearTimeout(timer); abort.abort() }
  }, [subject, html, open])

  const insert = (variable: string) => {
    const el = area.current
    const token = `$${variable}`
    if (!el) { setHtml((h) => h + token); return }
    const [from, to] = [el.selectionStart, el.selectionEnd]
    setHtml(html.slice(0, from) + token + html.slice(to))
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(from + token.length, from + token.length) })
  }

  const fields = <><input type="hidden" name="key" value={keyName} />{back}<input type="hidden" name="subject" value={subject} /><input type="hidden" name="html" value={html} /></>
  return (
    <div className="tpl-editor" ref={root}>
      <div className="tpl-editor__edit">
        <div className="field"><label htmlFor={`s-${keyName}`}>Email subject</label><input id={`s-${keyName}`} value={subject} onChange={(e) => setSubject(e.target.value)} required /></div>
        <div className="field"><label htmlFor={`h-${keyName}`}>HTML template</label><textarea id={`h-${keyName}`} ref={area} rows={9} value={html} onChange={(e) => setHtml(e.target.value)} spellCheck={false} /></div>
        {variables.length ? (
          <div className="tpl-vars" role="group" aria-label="Variabel yang bisa dipakai">
            <span className="mini muted">Variabel (klik untuk menyisipkan di kursor):</span>
            {variables.map((v) => <button type="button" key={v} className="tpl-var" onClick={() => insert(v)}>${v}</button>)}
          </div>
        ) : null}
        <div className="inline-actions">
          <PendingForm action={save}>{fields}<AsyncButton className="button">Save template</AsyncButton></PendingForm>
          <PendingForm action={test}>{fields}<AsyncButton className="button-outline" busy="Mengirim contoh email…" confirm={false}>Send example to the administrator</AsyncButton></PendingForm>
        </div>
        <p className="mini muted" role="status" aria-live="polite">{dirty ? 'Perubahan belum disimpan. Contoh email memakai isian di atas, bukan versi yang tersimpan.' : 'Tidak ada perubahan.'}</p>
      </div>
      <div className="tpl-editor__preview" aria-live="polite" aria-label={`Pratinjau ${name}`}>
        <div className="tpl-preview__bar">
          <strong>Pratinjau</strong> <span className="mini muted">data contoh, bukan data asli</span>
          {preview.state === 'loading' ? <span className="mini"><span className="spin" aria-hidden="true" /> Memperbarui…</span> : null}
        </div>
        {preview.state === 'error' ? <p className="alert" role="alert">{preview.message}</p> : null}
        {preview.state === 'ready' ? <p className="tpl-preview__subject"><span className="mini muted">Subjek:</span> {preview.subject}</p> : null}
        {preview.state === 'ready' && preview.unknown.length ? <p className="note">Variabel ini tidak dikenal dan akan tampil apa adanya: {preview.unknown.map((u) => `$${u}`).join(', ')}</p> : null}
        {preview.state === 'ready' ? (
          <iframe title={`Pratinjau email ${name}`} sandbox="" srcDoc={`<!doctype html><meta charset="utf-8"><base target="_blank"><body style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1b2430;margin:16px">${preview.html}</body>`} />
        ) : <div className="skeleton tpl-preview__skeleton" aria-hidden="true" />}
      </div>
    </div>
  )
}
