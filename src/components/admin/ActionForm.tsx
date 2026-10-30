'use client'
import { createContext, useActionState, useContext, useEffect, useRef, useState, type InputHTMLAttributes, type ReactNode, type Ref, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { CONNECTION_LOST, FormScope, isRedirect, typedFrom, useScope, useSubmitter } from '@/components/feedback/scope'
import { AsyncButton } from '@/components/feedback/AsyncButton'
import type { FormState } from '@/server/action'

type Action = (previous: FormState, form: FormData) => Promise<FormState>
const Typed = createContext<FormState>({})

/**
 * A form for the long finance screens. When the server refuses a submission it answers with the message AND what
 * was typed, so the page shows the error and nothing has to be retyped. Success navigates away as usual.
 * A line under the fields says where the form stands: edited and not saved, saving, or not saved because the server refused it.
 */
export function ActionForm({ action, children, className }: { action: Action; children: ReactNode; className?: string }) {
  const [state, formAction, isPending] = useActionState(async (previous: FormState, form: FormData): Promise<FormState> => {
    try { return await action(previous, form) } catch (e) { if (isRedirect(e)) throw e; return { error: CONNECTION_LOST, values: typedFrom(form) } }
  }, {} as FormState)
  const [submitter, track] = useSubmitter()
  const [dirty, setDirty] = useState(false)
  const alertRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (state.error) { alertRef.current?.focus(); alertRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }) }
  }, [state])
  return (
    <Typed.Provider value={state}>
      <FormScope.Provider value={{ pending: isPending, submitter }}>
        <form action={formAction} className={className} onSubmit={track} onInput={() => setDirty(true)} onChange={() => setDirty(true)} aria-busy={isPending || undefined}>
          {state.error ? <div className="alert" role="alert" tabIndex={-1} ref={alertRef}>{state.error}</div> : null}
          {children}
          <SaveStatus dirty={dirty} failed={Boolean(state.error)} />
        </form>
      </FormScope.Provider>
    </Typed.Provider>
  )
}

/** Unsaved / saving / not saved. Nothing is shown for a clean form, and "saved" is never shown here: a saved form has left the page. */
function SaveStatus({ dirty, failed }: { dirty: boolean; failed: boolean }) {
  const { pending } = useScope()
  const [late, setLate] = useState(false)
  useEffect(() => {
    if (!pending) { setLate(false); return }
    const timer = setTimeout(() => setLate(true), 140)
    return () => clearTimeout(timer)
  }, [pending])
  const text = pending ? (late ? 'Menyimpan perubahan…' : '') : failed ? 'Gagal menyimpan perubahan. Data yang Anda isi masih ada.' : dirty ? 'Perubahan belum disimpan' : ''
  return <p className={`form-status${failed && !pending ? ' is-failed' : ''}`} role="status" aria-live="polite">{text}</p>
}

/** The value to show in a field: what the user last typed if the server sent it back, else the saved/default value. */
function useTyped(name: string, fallback: string): string {
  const v = useContext(Typed).values?.[name]
  return v === undefined ? fallback : Array.isArray(v) ? v[0] ?? '' : v
}
export function useTypedList(name: string): string[] | undefined {
  const v = useContext(Typed).values?.[name]
  return v === undefined ? undefined : Array.isArray(v) ? v : [v]
}

export function Submit({ children, className = 'button', busy }: { children: ReactNode; className?: string; busy?: string }) {
  return <AsyncButton className={className} busy={busy}>{children}</AsyncButton>
}

export const FInput = ({ fallback = '', ...p }: InputHTMLAttributes<HTMLInputElement> & { name: string; fallback?: string }) => <input {...p} defaultValue={useTyped(p.name, fallback)} />
export const FTextarea = ({ fallback = '', ...p }: TextareaHTMLAttributes<HTMLTextAreaElement> & { name: string; fallback?: string }) => <textarea {...p} defaultValue={useTyped(p.name, fallback)} />
export const FSelect = ({ fallback = '', children, ...p }: SelectHTMLAttributes<HTMLSelectElement> & { name: string; fallback?: string; ref?: Ref<HTMLSelectElement> }) => <select {...p} defaultValue={useTyped(p.name, fallback)}>{children}</select>

/** A checkbox that stays ticked (or unticked) the way the user left it after a refused submission. */
export function FCheckbox({ name, value, fallbackChecked = false, ...p }: InputHTMLAttributes<HTMLInputElement> & { name: string; value: string; fallbackChecked?: boolean }) {
  const typed = useTypedList(name)
  return <input {...p} type="checkbox" name={name} value={value} defaultChecked={typed ? typed.includes(value) : fallbackChecked} />
}
