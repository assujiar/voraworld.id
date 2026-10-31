'use client'
import { startRegistration } from '@simplewebauthn/browser'
import { useState } from 'react'

/** Registers a passkey on this device for the signed-in signer. The private key stays on the device; the server keeps only the public key. */
export function PasskeyRegister() {
  const [state, setState] = useState<{ tone: 'ok' | 'bad' | 'busy' | ''; text: string }>({ tone: '', text: '' })
  const [label, setLabel] = useState('')
  const run = async () => {
    setState({ tone: 'busy', text: 'Menyiapkan pendaftaran passkey…' })
    try {
      const options = await (await fetch('/admin/signing/passkey', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ step: 'options' }) })).json().catch(() => null)
      if (!options?.challenge) throw new Error('The server did not start the registration')
      setState({ tone: 'busy', text: 'Konfirmasi dengan perangkat Anda (sidik jari, wajah atau PIN)…' })
      const response = await startRegistration({ optionsJSON: options })
      setState({ tone: 'busy', text: 'Menyimpan passkey…' })
      const done = await fetch('/admin/signing/passkey', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ step: 'verify', response, label }) })
      if (!done.ok) throw new Error(await done.text())
      setState({ tone: 'ok', text: 'Passkey terdaftar. Memuat ulang halaman…' })
      setTimeout(() => location.reload(), 1200)
    } catch (e) { setState({ tone: 'bad', text: e instanceof Error ? e.message : 'The passkey could not be registered' }) }
  }
  return (
    <div>
      <label className="mini" htmlFor="pk-label">Name of this device (optional)</label>
      <input id="pk-label" value={label} maxLength={80} onChange={(e) => setLabel(e.target.value)} style={{ maxWidth: 280 }} />{' '}
      <button type="button" className={`button${state.tone === 'busy' ? ' is-busy' : ''}`} onClick={() => void run()} disabled={state.tone === 'busy' || state.tone === 'ok'} aria-busy={state.tone === 'busy' || undefined}>
        {state.tone === 'busy' ? <><span className="spin" aria-hidden="true" /><span>{state.text}</span><span className="bar-wait" role="progressbar" aria-label={state.text} /></> : 'Register a passkey on this device'}
      </button>
      <p role="status" aria-live="polite" className="mini" style={{ color: state.tone === 'bad' ? '#8c2f25' : state.tone === 'ok' ? '#276650' : undefined }}>{state.tone === 'busy' ? '' : state.text}</p>
    </div>
  )
}
