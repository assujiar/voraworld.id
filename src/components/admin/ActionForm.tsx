'use client'
import { createContext, useActionState, useContext, type InputHTMLAttributes, type ReactNode, type Ref, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { useFormStatus } from 'react-dom'
import type { FormState } from '@/server/action'

type Action = (previous: FormState, form: FormData) => Promise<FormState>
const Typed = createContext<FormState>({})

/**
 * A form for the long finance screens. When the server refuses a submission it answers with the message AND what
 * was typed, so the page shows the error and nothing has to be retyped. Success navigates away as usual.
 */
export function ActionForm({ action, children, className }: { action: Action; children: ReactNode; className?: string }) {
  const [state, formAction] = useActionState(action, {} as FormState)
  return (
    <Typed.Provider value={state}>
      <form action={formAction} className={className}>
        {state.error ? <div className="alert" role="alert">{state.error}</div> : null}
        {children}
      </form>
    </Typed.Provider>
  )
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

export function Submit({ children, className = 'button' }: { children: ReactNode; className?: string }) {
  const { pending } = useFormStatus()
  return <button className={className} disabled={pending} aria-busy={pending}>{pending ? 'Working…' : children}</button>
}

export const FInput = ({ fallback = '', ...p }: InputHTMLAttributes<HTMLInputElement> & { name: string; fallback?: string }) => <input {...p} defaultValue={useTyped(p.name, fallback)} />
export const FTextarea = ({ fallback = '', ...p }: TextareaHTMLAttributes<HTMLTextAreaElement> & { name: string; fallback?: string }) => <textarea {...p} defaultValue={useTyped(p.name, fallback)} />
export const FSelect = ({ fallback = '', children, ...p }: SelectHTMLAttributes<HTMLSelectElement> & { name: string; fallback?: string; ref?: Ref<HTMLSelectElement> }) => <select {...p} defaultValue={useTyped(p.name, fallback)}>{children}</select>

/** A checkbox that stays ticked (or unticked) the way the user left it after a refused submission. */
export function FCheckbox({ name, value, fallbackChecked = false, ...p }: InputHTMLAttributes<HTMLInputElement> & { name: string; value: string; fallbackChecked?: boolean }) {
  const typed = useTypedList(name)
  return <input {...p} type="checkbox" name={name} value={value} defaultChecked={typed ? typed.includes(value) : fallbackChecked} />
}
