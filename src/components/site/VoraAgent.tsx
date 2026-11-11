'use client'

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import Image from 'next/image'
import type { Locale } from '@/content'
import { AgentRichText, safeVoraPath } from './AgentRichText'
import type { AgentSalutation } from '@/server/agent/personalization'

type Turn = { role: 'user' | 'assistant'; content: string }
type AgentAction = { type: 'request_quote'; href: string; label: string; reason: string }
type Handoff = { message: string; consent: boolean; website: string }
type Visitor = { name: string; salutation: AgentSalutation | ''; company: string; email: string; phone: string; consent: boolean; website: string }
const blankVisitor: Visitor = { name: '', salutation: '', company: '', email: '', phone: '', consent: false, website: '' }
const blankHandoff: Handoff = { message: '', consent: false, website: '' }

const words = {
  en: {
    launcher: 'Ask VORA', heading: 'VORA Virtual Agent', subtitle: 'Logistics guidance, on demand', close: 'Close chat',
    greeting: 'Hi. What shipment or logistics question can I help with?',
    hints: ['Ship cargo overseas', 'Customs clearance', 'Heavy-lift / OOG'],
    privacy: 'AI responses may be inaccurate. Avoid sharing confidential information.',
    consent: 'I agree to VORA recording and checking these contact details against existing business contacts to prevent duplicates. Chat messages are processed by the AI provider currently selected by VORA (Google or OpenAI); processing and retention are subject to the provider terms and account settings. Chat history expires after 7 days; business contact details are kept separately.',
    privacyLink: 'Privacy notice', input: 'Ask about a shipment or service…', send: 'Send message', sending: 'Thinking…',
    reset: 'Delete chat & start over', rfq: 'Request a Quote', handoff: 'Send to the team',
    loading: 'Loading conversation…', offline: 'The assistant is not available right now.',
    rate: 'The chat limit has been reached. Please try again later or send an inquiry.',
    failure: 'I couldn’t respond right now. Please try again, or contact the team using the inquiry form.',
    leadTitle: 'Share this inquiry', leadNote: 'Review and edit the summary below. It will be submitted to VORA’s inquiry system, not to Gemini.',
    name: 'Full name', salutation: 'Preferred form of address', salutationPlaceholder: 'Choose how to address you', email: 'Email address', phone: 'Mobile / WhatsApp', company: 'Company name', summary: 'Inquiry summary',
    registerTitle: 'Before we start', registerDesc: 'Tell us a little about yourself to start chatting with VORA.', registerSubmit: 'Start conversation', registering: 'Setting up your chat…', registerError: 'Could not start the chat. Check your details or try again.', registeredInfo: 'Contact details received for this conversation.',
    leadConsent: 'I agree to VORA using these details to follow up on my inquiry under the privacy notice.',
    submit: 'Send inquiry', back: 'Back to chat', done: 'Inquiry received', doneText: 'Your reference is',
    leadError: 'The inquiry could not be sent. Please check the details and try again.',
    character: 'characters',
  },
  id: {
    launcher: 'Tanya VORA', heading: 'VORA Virtual Agent', subtitle: 'Tanya soal logistics dan pengiriman', close: 'Tutup chat',
    greeting: 'Halo. Ada kebutuhan pengiriman atau pertanyaan logistics yang bisa saya bantu?',
    hints: ['Kirim barang ke luar negeri', 'Customs clearance', 'Heavy-lift / OOG'],
    privacy: 'Jawaban AI bisa keliru. Hindari berbagi informasi rahasia.',
    consent: 'Saya setuju data kontak dicatat dan diperiksa dengan kontak bisnis VORA yang sudah ada untuk mencegah duplikasi. Pesan chat diproses penyedia AI yang dipilih VORA (Google atau OpenAI), sesuai kebijakan pemrosesan data masing-masing penyedia. Histori chat kedaluwarsa setelah 7 hari; data kontak bisnis disimpan terpisah.',
    privacyLink: 'Pemberitahuan privasi', input: 'Tanya soal pengiriman atau layanan…', send: 'Kirim pesan', sending: 'Sedang menjawab…',
    reset: 'Hapus chat & mulai baru', rfq: 'Minta Penawaran', handoff: 'Teruskan ke tim',
    loading: 'Memuat percakapan…', offline: 'Asisten sedang tidak tersedia.',
    rate: 'Batas chat sementara sudah tercapai. Coba lagi nanti atau kirim inquiry.',
    failure: 'Pesan belum bisa dijawab. Coba lagi atau hubungi tim melalui form inquiry.',
    leadTitle: 'Kirim inquiry ke tim', leadNote: 'Periksa dan edit ringkasan di bawah ini. Informasi akan masuk ke sistem inquiry VORA, bukan dikirim ke Gemini.',
    name: 'Nama lengkap', salutation: 'Sapaan yang diinginkan', salutationPlaceholder: 'Pilih sapaan', email: 'Alamat email', phone: 'No. HP / WhatsApp', company: 'Nama perusahaan', summary: 'Ringkasan inquiry',
    registerTitle: 'Sebelum mulai ngobrol', registerDesc: 'Isi data singkat berikut untuk mulai chat dengan VORA.', registerSubmit: 'Mulai percakapan', registering: 'Menyiapkan chat…', registerError: 'Chat belum bisa dimulai. Periksa data dan coba lagi.', registeredInfo: 'Data kontak sudah diterima untuk percakapan ini.',
    leadConsent: 'Saya setuju VORA menggunakan informasi ini untuk menindaklanjuti inquiry sesuai pemberitahuan privasi.',
    submit: 'Kirim inquiry', back: 'Kembali ke chat', done: 'Inquiry diterima', doneText: 'Nomor referensi',
    leadError: 'Inquiry belum berhasil dikirim. Periksa data dan coba lagi.',
    character: 'karakter',
  },
}

type AgentIconName = 'refresh' | 'close' | 'send' | 'external' | 'arrow' | 'check'

/** One consistent, legible icon system for all VORA Agent actions. */
function AgentIcon({ name }: { name: AgentIconName }) {
  return <svg className={`vora-agent-icon vora-agent-icon--${name}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.15" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {name === 'refresh' && <><path d="M20 8a8 8 0 1 0 1 5.5"/><path d="M20 3v5h-5"/></>}
    {name === 'close' && <path d="M5.5 5.5l13 13m0-13-13 13"/>}
    {name === 'send' && <><path d="M4.5 12h15"/><path d="M13 5.5l6.5 6.5-6.5 6.5"/></>}
    {name === 'external' && <><path d="M7 17 17 7"/><path d="M8.5 7H17v8.5"/></>}
    {name === 'arrow' && <><path d="M4.5 12h15"/><path d="m13.5 6 6 6-6 6"/></>}
    {name === 'check' && <path d="m4.5 12 5 5 10-10"/>}
  </svg>
}

/** The image is the supplied official VORA Agent artwork, not a generated brand substitute. */
function AgentAvatar({ small = false }: { small?: boolean }) {
  return <span className={`vora-agent-avatar${small ? ' vora-agent-avatar--small' : ''}`} aria-hidden="true">
    <Image src="/static/assets/vora-agent-profile.png" alt="" width={52} height={52} sizes={small ? '38px' : '46px'} className="vora-agent-avatar__image" />
  </span>
}

function summaryFrom(turns: Turn[], locale: Locale) {
  const title = locale === 'id' ? 'Percakapan dengan VORA Virtual Agent' : 'Conversation with VORA Virtual Agent'
  return [title, ...turns.slice(-12).map((t) => `${t.role === 'user' ? 'Visitor' : 'VORA Virtual Agent'}: ${t.content}`)].join('\n\n').slice(0, 5200)
}

export function VoraAgent({ locale }: { locale: Locale }) {
  const t = words[locale]
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [open, setOpen] = useState(false)
  const [turns, setTurns] = useState<Turn[]>([])
  const [actions, setActions] = useState<AgentAction[]>([])
  const [input, setInput] = useState('')
  const [registered, setRegistered] = useState(false)
  const [visitor, setVisitor] = useState<Visitor>(blankVisitor)
  const [registerBusy, setRegisterBusy] = useState(false)
  const [registerError, setRegisterError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lead, setLead] = useState<Handoff | null>(null)
  const [leadBusy, setLeadBusy] = useState(false)
  const [leadResult, setLeadResult] = useState('')
  const [leadError, setLeadError] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const launcherRef = useRef<HTMLButtonElement>(null)
  const ongoing = useRef(false)

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/agent/chat', { cache: 'no-store', credentials: 'same-origin', signal: controller.signal })
      .then(async (r) => { if (!r.ok) throw new Error('history'); return r.json() })
      .then((data: { enabled?: boolean; registered?: boolean; messages?: Turn[]; actions?: AgentAction[] }) => {
        setEnabled(data.enabled === true)
        setRegistered(data.registered === true)
        setActions(Array.isArray(data.actions) ? data.actions.filter((a) => a.type === 'request_quote' && Boolean(safeVoraPath(a.href))) : [])
        if (Array.isArray(data.messages)) {
          const loaded = data.messages.filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
          setTurns(loaded)
        }
      })
      .catch(() => { if (!controller.signal.aborted) setEnabled(false) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (open) {
      const node = scrollRef.current
      if (node) node.scrollTop = node.scrollHeight
    }
  }, [turns, open, busy, error, lead])

  useEffect(() => {
    if (!open) return
    const listener = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        setLead(null)
        launcherRef.current?.focus()
      }
    }
    document.addEventListener('keydown', listener)
    return () => document.removeEventListener('keydown', listener)
  }, [open])

  async function resetChat() {
    if (busy || leadBusy || registerBusy) return
    try {
      const response = await fetch('/api/agent/chat', { method: 'DELETE', credentials: 'same-origin' })
      if (!response.ok) { setError(t.failure); return }
      setTurns([])
      setActions([])
      setInput('')
      setError('')
      setRegistered(false)
      setVisitor(blankVisitor)
      setRegisterError('')
      setLead(null)
    } catch { setError(t.failure) }
  }

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (registerBusy || !visitor.consent) return
    setRegisterBusy(true)
    setRegisterError('')
    try {
      const r = await fetch('/api/agent/register', {
        method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...visitor, locale }),
      })
      const result = await r.json() as { registered?: boolean }
      if (!r.ok || !result.registered) { setRegisterError(r.status === 429 ? t.rate : t.registerError); return }
      setRegistered(true)
      setError('')
      setTimeout(() => inputRef.current?.focus(), 80)
    } catch { setRegisterError(t.registerError) }
    finally { setRegisterBusy(false) }
  }

  const startLead = () => {
    setLead({ ...blankHandoff, message: summaryFrom(turns, locale) })
    setLeadResult('')
    setLeadError('')
  }

  async function send(message: string) {
    const value = message.trim()
    if (!value || value.length > 1800 || !registered || ongoing.current) return
    ongoing.current = true
    setBusy(true)
    setInput('')
    setError('')
    setTurns((prev) => [...prev, { role: 'user', content: value }])
    try {
      const r = await fetch('/api/agent/chat', {
        method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: value, locale, consent: true }),
      })
      const result = await r.json() as { reply?: string; error?: string; actions?: AgentAction[] }
      if (!r.ok || !result.reply) {
        if (Array.isArray(result.actions)) setActions(result.actions.filter((a) => a.type === 'request_quote' && Boolean(safeVoraPath(a.href))))
        if (r.status === 403 && result.error === 'registration_required') setRegistered(false)
        setError(r.status === 429 ? t.rate : t.failure)
      } else {
        setTurns((prev) => [...prev, { role: 'assistant', content: result.reply! }])
        setActions(Array.isArray(result.actions) ? result.actions.filter((a) => a.type === 'request_quote' && Boolean(safeVoraPath(a.href))) : [])
      }
    } catch { setError(t.failure) }
    finally { ongoing.current = false; setBusy(false); inputRef.current?.focus() }
  }

  function submitMessage(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void send(input) }
  function inputKey(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(input) }
  }

  async function submitLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!lead || leadBusy || !lead.consent || !registered) return
    setLeadBusy(true)
    setLeadError('')
    try {
      const r = await fetch('/api/agent/lead', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(lead) })
      const result = await r.json() as { reference?: string; error?: string }
      if (!r.ok || !result.reference) { setLeadError(result.error === 'rate_limit' ? t.rate : t.leadError); return }
      setLeadResult(result.reference)
    } catch { setLeadError(t.leadError) }
    finally { setLeadBusy(false) }
  }

  if (enabled !== true) return null

  return <aside className={`vora-agent${open ? ' vora-agent--open' : ''}`} aria-label={t.heading}>
    {open && <section className="vora-agent-panel" role="dialog" aria-modal="false" aria-label={t.heading}>
      <header className="vora-agent-header">
        <AgentAvatar />
        <div className="vora-agent-header__text"><strong>{t.heading}</strong><span>{t.subtitle}</span></div>
        <button className="vora-agent-icon-button" type="button" onClick={() => void resetChat()} disabled={busy || leadBusy || registerBusy} aria-label={t.reset} title={t.reset}>
          <AgentIcon name="refresh" />
        </button>
        <button className="vora-agent-icon-button" type="button" onClick={() => { setOpen(false); setLead(null); launcherRef.current?.focus() }} aria-label={t.close} title={t.close}>
          <AgentIcon name="close" />
        </button>
      </header>

      {!registered ? <div className="vora-agent-register">
        <div className="vora-agent-register__intro">
          <span className="vora-agent-register__eyebrow">VORA / VIRTUAL AGENT</span>
          <h3>{t.registerTitle}</h3><p>{t.registerDesc}</p>
        </div>
        <form onSubmit={register} className="vora-agent-register__form">
          <div className="vora-agent-trap" aria-hidden="true"><label>Website<input tabIndex={-1} autoComplete="off" value={visitor.website} onChange={(e) => setVisitor({ ...visitor, website: e.target.value })}/></label></div>
          <label>{t.name}<input required minLength={2} maxLength={140} autoComplete="name" value={visitor.name} onChange={(e) => setVisitor({ ...visitor, name: e.target.value })}/></label>
          <label>{t.salutation}<select required value={visitor.salutation} onChange={(e) => setVisitor({ ...visitor, salutation: e.target.value as Visitor['salutation'] })}>
            <option value="" disabled>{t.salutationPlaceholder}</option>
            <option value="bapak">Bapak / Pak</option>
            <option value="ibu">Ibu / Bu</option>
            <option value="mr">Mr.</option>
            <option value="ms">Ms.</option>
            <option value="mrs">Mrs.</option>
            <option value="name">{locale === 'id' ? 'Nama saja, tanpa sapaan' : 'First name only'}</option>
          </select></label>
          <label>{t.company}<input required minLength={2} maxLength={200} autoComplete="organization" value={visitor.company} onChange={(e) => setVisitor({ ...visitor, company: e.target.value })}/></label>
          <label>{t.phone}<input required type="tel" minLength={7} maxLength={40} autoComplete="tel" placeholder="+62 812 3456 7890" value={visitor.phone} onChange={(e) => setVisitor({ ...visitor, phone: e.target.value })}/></label>
          <label>{t.email}<input required type="email" maxLength={200} autoComplete="email" value={visitor.email} onChange={(e) => setVisitor({ ...visitor, email: e.target.value })}/></label>
          <label className="vora-agent-consent"><input type="checkbox" required checked={visitor.consent} onChange={(e) => setVisitor({ ...visitor, consent: e.target.checked })}/><span>{t.consent} <a href={`/${locale}/privacy`} target="_blank" rel="noopener noreferrer">{t.privacyLink}</a>.</span></label>
          {registerError && <p className="vora-agent-error" role="alert">{registerError}</p>}
          <button className="vora-agent-primary vora-agent-register__submit" disabled={registerBusy || loading} type="submit">{registerBusy ? t.registering : t.registerSubmit}<AgentIcon name="arrow" /></button>
        </form>
      </div> : lead ? <div className="vora-agent-lead" key="lead">
        {leadResult ? <div className="vora-agent-lead__success" role="status">
          <span aria-hidden="true"><AgentIcon name="check" /></span><h3>{t.done}</h3><p>{t.doneText}: <strong>{leadResult}</strong></p>
          <button className="vora-agent-text-button" type="button" onClick={() => setLead(null)}>{t.back}</button>
        </div> : <>
          <div className="vora-agent-lead__intro"><h3>{t.leadTitle}</h3><p>{t.leadNote}</p></div>
          <form onSubmit={submitLead} className="vora-agent-lead__form">
            <div className="vora-agent-trap" aria-hidden="true"><label>Website<input value={lead.website} tabIndex={-1} autoComplete="off" onChange={(e) => setLead({ ...lead, website: e.target.value })}/></label></div>
            <p className="vora-agent-lead__reuse">{t.registeredInfo}</p>
            <label>{t.summary}<textarea required rows={5} maxLength={5400} value={lead.message} onChange={(e) => setLead({ ...lead, message: e.target.value })}/></label>
            <label className="vora-agent-consent"><input type="checkbox" required checked={lead.consent} onChange={(e) => setLead({ ...lead, consent: e.target.checked })}/><span>{t.leadConsent} <a href={`/${locale}/privacy`} target="_blank" rel="noopener noreferrer">{t.privacyLink}</a>.</span></label>
            {leadError && <p className="vora-agent-error" role="alert">{leadError}</p>}
            <div className="vora-agent-lead__actions"><button className="vora-agent-text-button" type="button" onClick={() => setLead(null)}>{t.back}</button><button className="vora-agent-primary" disabled={leadBusy} type="submit">{leadBusy ? t.sending : t.submit}</button></div>
          </form>
        </>}
      </div> : <>
        <div className="vora-agent-conversation" ref={scrollRef} aria-label="Conversation" aria-live="polite" aria-relevant="additions text">
          <div className="vora-agent-greeting"><span className="vora-agent-greeting__eyebrow">VORA / VIRTUAL AGENT</span><p>{t.greeting}</p></div>
          {loading && <p className="vora-agent-system">{t.loading}</p>}
          {turns.map((turn, index) => <div key={`${index}-${turn.role}`} className={`vora-agent-bubble vora-agent-bubble--${turn.role}`}>
            {turn.role === 'assistant' && <span className="vora-agent-bubble__from"><AgentAvatar small />VORA Virtual Agent</span>}
            {turn.role === 'assistant' ? <AgentRichText content={turn.content} locale={locale} /> : <span>{turn.content}</span>}
          </div>)}
          {actions.map((action) => <a key={action.type} className="vora-agent-safety-cta" href={safeVoraPath(action.href) || `/${locale}/request-quote`} target="_blank" rel="noopener noreferrer"><span>{action.label}</span><AgentIcon name="external" /></a>)}
          {busy && <div className="vora-agent-typing" role="status" aria-label={t.sending}><i/><i/><i/></div>}
          {error && <p className="vora-agent-error" role="alert">{error}</p>}
          {turns.length === 0 && !loading && <div className="vora-agent-suggestions">{t.hints.map((hint) => <button type="button" key={hint} onClick={() => void send(hint)} disabled={!registered || busy}>{hint}<AgentIcon name="arrow" /></button>)}</div>}
        </div>
        <div className="vora-agent-actions"><a href={`/${locale}/request-quote`}>{t.rfq}<AgentIcon name="external" /></a><button type="button" onClick={startLead} disabled={busy || !turns.length}>{t.handoff}<AgentIcon name="arrow" /></button></div>
        <div className="vora-agent-compose">
          <form onSubmit={submitMessage} className="vora-agent-compose__form">
            <textarea ref={inputRef} rows={2} aria-label={t.input} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={inputKey} maxLength={1800} placeholder={t.input} disabled={busy || loading}/>
            <button type="submit" disabled={!registered || !input.trim() || busy || loading} aria-label={t.send} title={t.send}>
              <AgentIcon name="send" />
            </button>
          </form>
          <div className="vora-agent-compose__bottom"><span>{t.heading}</span><span>{input.length}/1800</span></div>
        </div>
      </>}
    </section>}
    <button ref={launcherRef} type="button" className="vora-agent-launcher" aria-label={open ? t.close : t.launcher} aria-expanded={open} onClick={() => { setOpen((v) => !v); setLead(null); setTimeout(() => inputRef.current?.focus(), 80) }}>
      <AgentAvatar small/><span>{open ? t.close : t.launcher}</span><AgentIcon name={open ? 'close' : 'arrow'} />
    </button>
  </aside>
}
