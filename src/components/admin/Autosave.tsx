'use client'
import { useEffect, useRef, useState } from 'react'

type State =
  | { kind: 'clean' } | { kind: 'dirty' } | { kind: 'saving' }
  | { kind: 'saved'; at: Date } | { kind: 'failed'; message: string } | { kind: 'conflict'; message: string }

const IDLE_MS = 3000
const clock = (d: Date) => d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).replace('.', ':')

/**
 * Keeps a DRAFT while it is being written. Three seconds after the last keystroke the form's fields go to the server, which saves them only if the
 * draft is still the version this page loaded (`base`); otherwise nothing is overwritten and the writer is told to reload. A failed autosave says so
 * and tries again with the next change; pressing the form's own Save button stops it, so the two never race. It never touches a published item.
 */
export function Autosave({ kind, id, base }: { kind: 'article' | 'page'; id: number; base: string }) {
  const [state, setState] = useState<State>({ kind: 'clean' })
  const version = useRef(base)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const inflight = useRef<AbortController>(undefined)
  const holder = useRef<HTMLParagraphElement>(null)
  const stopped = useRef(false)
  const busy = useRef(false)

  useEffect(() => {
    const form = holder.current?.closest('form')
    if (!form) return
    const collect = () => {
      const out: Record<string, string> = {}
      new FormData(form).forEach((v, k) => { if (typeof v === 'string' && !k.startsWith('$ACTION') && k !== '_back' && k !== 'action' && k !== 'record') out[k] = v })
      return out
    }
    const run = async (): Promise<void> => {
      if (stopped.current) return
      if (busy.current) { timer.current = setTimeout(() => void run(), 500); return }          // one request at a time: the next one needs the version this one returns
      busy.current = true
      inflight.current = new AbortController()
      setState({ kind: 'saving' })
      try {
        const res = await fetch(`/admin/api/autosave/${kind}`, { method: 'POST', signal: inflight.current.signal, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...collect(), id, base: version.current }) })
        if (res.ok) {
          const body = await res.json()
          version.current = body.updatedAt
          setState({ kind: 'saved', at: new Date() })
          return
        }
        const text = (await res.text()).slice(0, 300)
        if (res.status === 409) { stopped.current = true; setState({ kind: 'conflict', message: text }); return }
        setState({ kind: 'failed', message: res.status === 401 ? 'Sesi Anda sudah berakhir. Masuk lagi di tab lain, lalu simpan dengan tombol Save draft.' : text || 'Belum tersimpan otomatis.' })
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setState({ kind: 'failed', message: 'Koneksi terputus, jadi draf belum tersimpan otomatis. Isian Anda masih ada di halaman.' })
      } finally {
        busy.current = false
      }
    }
    const change = () => {
      if (stopped.current) return
      setState({ kind: 'dirty' })
      clearTimeout(timer.current)
      timer.current = setTimeout(() => void run(), IDLE_MS)
    }
    const submit = () => { stopped.current = true; clearTimeout(timer.current); inflight.current?.abort() }   // the person pressed Save: that save is the one that counts
    form.addEventListener('input', change); form.addEventListener('change', change); form.addEventListener('submit', submit)
    return () => { clearTimeout(timer.current); inflight.current?.abort(); form.removeEventListener('input', change); form.removeEventListener('change', change); form.removeEventListener('submit', submit) }
  }, [kind, id])

  const text =
    state.kind === 'dirty' ? 'Perubahan akan disimpan otomatis sebagai draf…'
    : state.kind === 'saving' ? 'Menyimpan draf…'
    : state.kind === 'saved' ? `Draf tersimpan otomatis pukul ${clock(state.at)} WIB. Belum dipublikasikan.`
    : state.kind === 'failed' || state.kind === 'conflict' ? state.message
    : 'Draf disimpan otomatis beberapa detik setelah Anda berhenti mengetik.'
  return (
    <p ref={holder} className={`form-status${state.kind === 'failed' || state.kind === 'conflict' ? ' is-failed' : ''}`} role="status" aria-live="polite" data-autosave={state.kind}>
      {text}{state.kind === 'conflict' ? <> <a href="" onClick={(e) => { e.preventDefault(); location.reload() }}>Muat ulang</a></> : null}
    </p>
  )
}
