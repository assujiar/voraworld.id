'use client'
import { createContext, useActionState, useCallback, useContext, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'

/**
 * Where a form stands, for the buttons inside it. The source is the form's own action state (`useActionState`), because `useFormStatus` stayed
 * false while a request was running under the React build this project ships (measured, not assumed: the same form reported `isPending = true`).
 * `submitter` is the button that was pressed, so that only that button shows the busy label.
 */
export interface Scope { pending: boolean; submitter: { name: string; value: string } | null }
export const FormScope = createContext<Scope>({ pending: false, submitter: null })
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
  return (
    <FormScope.Provider value={{ pending, submitter }}>
      <form action={run} onSubmit={track} className={className} style={style} id={id} aria-busy={pending || undefined}>
        {failure && !pending ? <div className="alert" role="alert">{failure}</div> : null}
        {children}
      </form>
    </FormScope.Provider>
  )
}
