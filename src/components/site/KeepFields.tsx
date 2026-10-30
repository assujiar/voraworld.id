'use client'
import { useEffect } from 'react'

/**
 * When the server refuses an inquiry the page is loaded again with the reason in the address, and a form that comes back empty makes people type
 * everything again. This keeps what was typed in this tab (sessionStorage, never sent anywhere, never in the address) and puts it back only after a
 * refusal; a successful send clears it. The consent box is never restored: consent must be given again each time.
 */
export function KeepFields({ formId, storageKey }: { formId: string; storageKey: string }) {
  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null
    if (!form) return
    const params = new URLSearchParams(window.location.search)
    try {
      if (params.get('sent')) sessionStorage.removeItem(storageKey)
      else if (params.get('error')) {
        const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? '{}') as Record<string, string>
        for (const [name, value] of Object.entries(saved)) {
          const el = form.elements.namedItem(name) as unknown as { value?: string } | null
          if (el && typeof el.value === 'string' && !el.value) el.value = value
        }
      }
    } catch { /* storage unavailable: the form simply starts empty */ }
    const save = () => {
      const data: Record<string, string> = {}
      new FormData(form).forEach((v, k) => { if (typeof v === 'string' && k !== 'consent' && k !== 'website' && k !== 'locale' && k !== '_back' && !k.startsWith('$ACTION')) data[k] = v })
      try { sessionStorage.setItem(storageKey, JSON.stringify(data)) } catch { /* ignore */ }
    }
    form.addEventListener('submit', save)
    return () => form.removeEventListener('submit', save)
  }, [formId, storageKey])
  return null
}
