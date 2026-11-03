'use client'
import { useEffect, useId, useState } from 'react'

/** A real link with a tooltip available to pointers and keyboards. Escape dismisses it. */
export function ContactAction({ href, icon, label, description, external = false }: {
  href: string; icon: 'email' | 'directions'; label: string; description: string; external?: boolean
}) {
  const tooltipId = useId()
  const [dismissed, setDismissed] = useState(false)
  useEffect(() => {
    const dismiss = (event: KeyboardEvent) => { if (event.key === 'Escape') setDismissed(true) }
    document.addEventListener('keydown', dismiss)
    return () => document.removeEventListener('keydown', dismiss)
  }, [])
  return <span className="ux-contact-control" data-tooltip-dismissed={dismissed || undefined}
    onPointerEnter={() => setDismissed(false)} onPointerLeave={() => setDismissed(false)}
    onFocus={() => setDismissed(false)} onBlur={() => setDismissed(false)}>
    <a className="ux-contact-action" href={href} aria-label={description} aria-describedby={tooltipId}
      target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        {icon === 'email' ? <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></> : <><path d="m12 2 10 10-10 10L2 12Z" /><path d="M8 16v-4a2 2 0 0 1 2-2h6m-3-3 3 3-3 3" /></>}
      </svg>
    </a>
    <span role="tooltip" id={tooltipId} className="ux-contact-tooltip">{label}</span>
  </span>
}
