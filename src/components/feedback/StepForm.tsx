'use client'
import { usePathname, useRouter } from 'next/navigation'
import { useTransition, type FormEvent, type ReactNode } from 'react'
import { StepPending } from './AsyncButton'

/**
 * A form that only changes the address (a filter, a search, "choose the customer, then their quotation"). It behaves like a plain GET form, but the
 * navigation is a transition, so the button can say that the next list is loading until it really has. The newest choice wins: a late answer for an
 * earlier choice is dropped by the router, so a previous customer's data never appears under a new one.
 */
export function StepForm({ children, className, style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  const router = useRouter()
  const path = usePathname()
  const [pending, start] = useTransition()
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const params = new URLSearchParams()
    new FormData(form).forEach((v, k) => { if (typeof v === 'string') params.append(k, v) })
    const target = form.getAttribute('action') || path
    start(() => router.push(`${target}?${params.toString()}`))
  }
  return (
    <StepPending.Provider value={pending}>
      <form method="get" onSubmit={submit} className={className} style={style} aria-busy={pending || undefined}>{children}</form>
    </StepPending.Provider>
  )
}
