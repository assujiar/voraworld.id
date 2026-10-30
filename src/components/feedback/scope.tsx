'use client'
import { createContext, startTransition, useActionState, useCallback, useContext, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'

/**
 * Where a form stands, for the buttons inside it. The source is the form's own action state (`useActionState`), because `useFormStatus` stayed
 * false while a request was running under the React build this project ships (measured, not assumed: the same form reported `isPending = true`).
 * `submitter` is the button that was pressed, so that only that button shows the busy label.
 */
/** How much of the chosen file(s) has really reached the server, counted by the browser. `done` means everything was sent and the server is now working on it. */
export interface Upload { file: string; sent: number; total: number; done: boolean }
export interface Scope { pending: boolean; submitter: { name: string; value: string } | null; upload: Upload | null }
export const FormScope = createContext<Scope>({ pending: false, submitter: null, upload: null })
export const useScope = () => useContext(FormScope)

export function submitterOf(e: FormEvent<HTMLFormElement>): Scope['submitter'] {
  const s = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | HTMLInputElement | null
  return s && s.getAttribute('name') ? { name: s.getAttribute('name')!, value: s.getAttribute('value') ?? '' } : null
}

/** For a form tracking which button was pressed. */
export function useSubmitter() {
  const [submitter, set] = useState<Scope['submitter']>(null)
  const track = useCallback((e: FormEvent<HTMLFormElement>) => set(submitterOf(e)), [])
  return [submitter, track] as const
}

type Run = (form: FormData) => void | Promise<unknown>

/** Sends one file to the staging route and reports the bytes that have really gone out. Resolves to the token the form carries in place of the file. */
function sendFile(file: File, onProgress: (sent: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/admin/api/upload')
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.min(e.loaded, file.size)) }
    xhr.onerror = () => reject(new Error(CONNECTION_LOST_UPLOAD))
    xhr.ontimeout = xhr.onerror
    xhr.onload = () => {
      let body: { token?: string; error?: string } = {}
      try { body = JSON.parse(xhr.responseText) } catch { body = { error: xhr.responseText.slice(0, 200) } }
      if (xhr.status >= 200 && xhr.status < 300 && body.token) { onProgress(file.size); resolve(body.token) }
      else reject(new Error(xhr.status === 401 ? 'Sesi Anda sudah berakhir. Masuk lagi, lalu pilih file itu kembali.' : body.error || 'File tidak bisa diunggah.'))
    }
    const form = new FormData()
    form.set('file', file)
    xhr.send(form)
  })
}
const CONNECTION_LOST_UPLOAD = 'Koneksi terputus saat mengunggah, jadi file belum sampai. Isian Anda masih ada; coba kirim lagi.'

/**
 * Forms with a chosen file send it first over a request whose progress is measured, then submit the form with a token where the file was. The action
 * runs exactly as before (the server turns the token back into the file). Forms without a file are untouched: `onSubmit` returns without doing anything.
 * The number shown is bytes sent / bytes to send; once everything is sent `done` is true and the server's own work (checking, storing) begins.
 */
export function useStagedUpload(run: (form: FormData) => void) {
  const [upload, setUpload] = useState<Upload | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const onSubmit = useCallback((e: FormEvent<HTMLFormElement>, track?: (e: FormEvent<HTMLFormElement>) => void) => {
    const form = e.currentTarget
    // Only the signed-in portal has the staging route; a visitor's own upload form keeps posting the file with the form.
    const inputs = location.pathname.startsWith('/admin') ? [...form.querySelectorAll<HTMLInputElement>('input[type=file]')].filter((i) => i.name && i.files && i.files.length > 0) : []
    if (!inputs.length) { setFailure(null); track?.(e); return }
    e.preventDefault()
    track?.(e)
    const data = new FormData(form, (e.nativeEvent as SubmitEvent).submitter)
    const files = inputs.flatMap((i) => [...i.files!].map((f) => ({ name: i.name, file: f })))
    const total = files.reduce((n, f) => n + f.file.size, 0)
    setFailure(null)
    void (async () => {
      let before = 0
      try {
        for (const { name, file } of files) {
          setUpload({ file: file.name, sent: before, total, done: false })
          const token = await sendFile(file, (sent) => setUpload({ file: file.name, sent: before + sent, total, done: false }))
          before += file.size
          data.delete(name)
          data.set(`${name}__staged`, token); data.set(`${name}__name`, file.name); data.set(`${name}__type`, file.type)
        }
        setUpload({ file: files[files.length - 1].file.name, sent: total, total, done: true })
        startTransition(() => { run(data) })
        setTimeout(() => setUpload(null), 0)
      } catch (err) {
        setUpload(null)
        setFailure(err instanceof Error ? err.message : CONNECTION_LOST_UPLOAD)
      }
    })()
  }, [run])
  return { upload, failure, onSubmit }
}

/** The text the user typed (never files), to put a refused form back the way it was. */
export function typedFrom(form: FormData): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {}
  for (const key of new Set(form.keys())) {
    if (key.startsWith('$ACTION') || key === '_back') continue
    const all = form.getAll(key).filter((v): v is string => typeof v === 'string')
    if (all.length) out[key] = all.length > 1 ? all : all[0]
  }
  return out
}

/** A redirect is how a Server Action reports success or refusal: it is not a failure and must reach Next. Anything else that throws is a lost connection. */
export const isRedirect = (e: unknown) => typeof (e as { digest?: unknown } | null)?.digest === 'string' && String((e as { digest: string }).digest).startsWith('NEXT_')

/**
 * Said when the request could not be completed. The server may or may not have received it, so the message does not promise either: for money and
 * documents, the person checks the record before sending the same thing again.
 */
export const CONNECTION_LOST = 'Koneksi terputus sebelum ada jawaban dari server, jadi hasilnya belum pasti. Isian Anda masih ada. Periksa halaman atau daftar terkait sebelum mengulang.'

/**
 * A form that runs a Server Action and tells its buttons while the request is in flight. It is a plain form otherwise: the action decides where to
 * go next (success or refusal both redirect with a notice), so nothing here claims a result.
 */
export function PendingForm({ action, children, className, style, id }: { action: Run; children: ReactNode; className?: string; style?: CSSProperties; id?: string }) {
  const [failure, run, pending] = useActionState(async (_previous: string | null, form: FormData) => {
    try { await action(form); return null } catch (e) { if (isRedirect(e)) throw e; return CONNECTION_LOST }
  }, null as string | null)
  const [submitter, track] = useSubmitter()
  const staged = useStagedUpload(run)
  const busy = pending || Boolean(staged.upload)
  return (
    <FormScope.Provider value={{ pending: busy, submitter, upload: staged.upload }}>
      <form action={run} onSubmit={(e) => staged.onSubmit(e, track)} className={className} style={style} id={id} aria-busy={busy || undefined}>
        {(failure && !busy) || staged.failure ? <div className="alert" role="alert">{staged.failure ?? failure}</div> : null}
        {children}
      </form>
    </FormScope.Provider>
  )
}
