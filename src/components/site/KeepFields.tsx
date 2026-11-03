'use client'
import { useEffect } from 'react'
import { DRAFT_FIELDS, safeDraft } from '@/lib/public-ux'

/** One tab-local draft per form, shared across languages. Hidden fields and consent never enter storage. */
export function KeepFields({ formId, storageKey }: { formId: string; storageKey: string }) {
  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null
    if (!form) return
    const params = new URLSearchParams(window.location.search)
    const key = storageKey.replace(/:(en|id)$/, '') + ':draft'
    const base = storageKey.replace(/:(en|id)$/, '')
    const clear = () => { try { for (const k of [key, `${base}:en`, `${base}:id`]) sessionStorage.removeItem(k) } catch { /* storage can be disabled */ } }
    const save = () => {
      const data: Record<string, string> = {}
      for (const name of DRAFT_FIELDS) {
        const field = form.elements.namedItem(name)
        if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) data[name] = field.value
      }
      try { sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), data: safeDraft(data) })) } catch { /* The live form still works. */ }
    }
    try {
      if (params.get('sent')) clear()
      else {
        const stored = JSON.parse(sessionStorage.getItem(key) ?? 'null') as {at?:number;data?:unknown}|null
        const fresh = stored?.at && Number.isFinite(stored.at) && Date.now() >= stored.at && Date.now() - stored.at < 4 * 60 * 60 * 1000
        const legacy = params.get('error') ? JSON.parse(sessionStorage.getItem(storageKey) ?? '{}') : {}
        const saved = safeDraft(fresh ? stored.data : legacy)
        for (const [name,value] of Object.entries(saved)) {
          if (name === 'mode' && params.has('mode')) continue
          const field = form.elements.namedItem(name)
          if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) {
            if (field instanceof HTMLSelectElement && ![...field.options].some(o=>o.value===value)) continue
            field.value=value
          }
        }
        if (stored && !fresh) sessionStorage.removeItem(key)
      }
    } catch { /* A malformed draft never blocks the form. */ }
    form.dispatchEvent(new Event('vora:draft-restored', {bubbles:true}))
    form.addEventListener('input',save);form.addEventListener('change',save);form.addEventListener('submit',save);form.addEventListener('vora:draft-clear',clear)
    return () => { form.removeEventListener('input',save);form.removeEventListener('change',save);form.removeEventListener('submit',save);form.removeEventListener('vora:draft-clear',clear) }
  }, [formId,storageKey])
  return null
}
