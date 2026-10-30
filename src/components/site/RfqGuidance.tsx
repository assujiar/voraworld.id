'use client'
import { useEffect, useState } from 'react'

/** Shows, under the cargo box, what to write for the service currently chosen in the form. It only reads the select; nothing is sent or stored. */
export function RfqGuidance({ selectId, groups, fallback, title }: { selectId: string; groups: Record<string, string[]>; fallback: string[]; title: string }) {
  const [mode, setMode] = useState('')
  useEffect(() => {
    const el = document.getElementById(selectId) as HTMLSelectElement | null
    if (!el) return
    const sync = () => setMode(el.value)
    sync()
    el.addEventListener('change', sync)
    return () => el.removeEventListener('change', sync)
  }, [selectId])
  const items = groups[mode.split('/')[0]] ?? fallback
  return (
    <div className="v-hint v-hint--list" id="rfq-guidance" aria-live="polite">
      <strong>{title}</strong>
      <ul>{items.map((i) => <li key={i}>{i}</li>)}</ul>
    </div>
  )
}
