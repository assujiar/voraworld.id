'use client'
import { startAuthentication } from '@simplewebauthn/browser'
import { useState } from 'react'
import { SealPlacer, type ConfirmedPlacement } from '@/components/admin/SealPlacer'
import { CONFIRMATIONS, CONFIRMATION_TEXT, type Confirmation } from '@/content/signing-consent'
import type { Lang } from '@/content/trust-mark'

/**
 * The signer's side of the ceremony: read the file shown in full, confirm what is being signed, place the signing mark, give each confirmation, and authenticate with the
 * passkey. The button stays off until the placement is confirmed and every box is ticked; the passkey then signs a payload the SERVER built from what it holds (never from
 * this page), so the page can neither change what is signed nor sign for anybody else.
 */
export function SigningCeremony({ requestId, fileUrl, verifyUrl, lang, signer, reference, purposeLabel, sha256, version, number, passkeys, changed, signatureType }: {
  requestId: number; fileUrl: string; verifyUrl: string; lang: Lang; signer: { name: string; position: string }; reference: string; purposeLabel: string
  sha256: string; version: number; number: string; passkeys: number; changed: boolean; signatureType: 1 | 2
}) {
  const [placement, setPlacement] = useState<ConfirmedPlacement | null>(null)
  const [ticks, setTicks] = useState<Record<Confirmation, boolean>>(() => Object.fromEntries(CONFIRMATIONS.map((c) => [c, false])) as Record<Confirmation, boolean>)
  const [state, setState] = useState<{ tone: 'ok' | 'bad' | 'busy' | ''; text: string }>({ tone: '', text: '' })
  const ready = Boolean(placement) && CONFIRMATIONS.every((c) => ticks[c]) && passkeys > 0 && !changed
  const sign = async () => {
    if (!placement) return
    setState({ tone: 'busy', text: 'Preparing what you will sign...' })
    try {
      const post = (body: unknown) => fetch(`/admin/signing/${requestId}/ceremony`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      const begun = await post({ step: 'begin', placement, confirmations: ticks })
      if (!begun.ok) throw new Error(await begun.text())
      setState({ tone: 'busy', text: 'Confirm with your passkey on this device...' })
      const response = await startAuthentication({ optionsJSON: await begun.json() })
      const done = await post({ step: 'finish', response })
      if (!done.ok) throw new Error(await done.text())
      const result = await done.json() as { ref: string }
      setState({ tone: 'ok', text: `Signed. Signing reference ${result.ref}.` })
      setTimeout(() => { location.href = '/admin/signers' }, 1500)
    } catch (e) { setState({ tone: 'bad', text: e instanceof Error ? e.message : 'The signing could not be completed' }) }
  }
  return (
    <div className="signing-ceremony">
      {changed ? <p className="alert" role="alert">The document has changed since this request was made. Nothing can be signed: ask for a new request.</p> : null}
      <section className="admin-panel">
        <h4>1. The file you are signing</h4>
        <p className="mini"><strong>{number}</strong> · version {version} · <span style={{ overflowWrap: 'anywhere' }}>SHA-256 {sha256}</span></p>
        <p className="mini"><a href={fileUrl} target="_blank" rel="noopener">Open the complete file in a new tab ↗</a> (read all of it before you sign)</p>
        <p className="mini">You sign as <strong>{signer.name}</strong>, {signer.position}. Purpose: <strong>{purposeLabel}</strong>. Reference {reference}.</p>
      </section>
      <section className="admin-panel">
        <SealPlacer initial={{}} verifyUrl={verifyUrl} lang={lang} sourceUrl={fileUrl} signer={signer} documentNumber={number} signatureType={signatureType} onPlacement={setPlacement} />
      </section>
      <section className="admin-panel">
        <h4>2. Your confirmations</h4>
        {CONFIRMATIONS.map((c) => (
          <label key={c} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', margin: '8px 0', fontWeight: 400 }}>
            <input type="checkbox" checked={ticks[c]} onChange={(e) => setTicks((t) => ({ ...t, [c]: e.target.checked }))} style={{ width: 'auto', minHeight: 0, marginTop: 4 }} />
            <span>{CONFIRMATION_TEXT[c].en}<br /><small className="muted">{CONFIRMATION_TEXT[c].id}</small></span>
          </label>
        ))}
      </section>
      <section className="admin-panel">
        <h4>3. Sign with your passkey</h4>
        {passkeys === 0 ? <p className="note">You have no passkey yet. Register one on <a href="/admin/signers">the signers page</a> first: it is how you prove that you are the one signing.</p> : null}
        <button type="button" className="button" disabled={!ready || state.tone === 'busy'} onClick={() => void sign()} data-testid="sign">Sign the document</button>
        {!ready && !changed ? <p className="mini muted">Confirm the placement, tick every confirmation{passkeys === 0 ? ' and register a passkey' : ''} to enable signing.</p> : null}
        <p role="status" aria-live="polite" className="mini" style={{ color: state.tone === 'bad' ? '#8c2f25' : state.tone === 'ok' ? '#276650' : undefined }}>{state.text}</p>
      </section>
    </div>
  )
}
