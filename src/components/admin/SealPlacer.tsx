'use client'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { useTypedValue } from '@/components/admin/ActionForm'
import { TrustMark } from '@/components/trust/TrustMark'
import { clampZoom, cssRect, describePlacement, dragTo, loupePosition, nudge, scaleOf, tapTo, type PageBox } from '@/content/placer-geometry'
import { sealDims, sealMarkOptions } from '@/content/seal-layout'
import type { Lang } from '@/content/trust-mark'
import { layoutSignature, type SignatureType } from '@/content/verification-blocks'

/**
 * Where the VORA mark goes on somebody else's PDF. The pages are drawn in this browser by PDF.js (the file is not sent anywhere for this); the mark shown on them is
 * the real one (the same layout the PDF is made from, with the approved artwork and the real QR code of this document's verification page), placed by the same
 * geometry (content/seal-layout.ts). So the person sees exactly what will be printed, where it will be printed.
 *
 * Mouse: click a place, drag the mark, arrow keys (Shift for bigger steps). Touch: tap a place, drag the mark by touching it (a floating full-size copy appears
 * above the finger, so that the hand never hides it; it stays out of the screen's edges), nudge buttons for fine adjustment, zoom, page buttons. Nothing is final until
 * "Confirm placement" is pressed, and any later change asks for it again. The choices travel with the form as hidden fields.
 */
type Mode = 'first' | 'last' | 'all' | 'one'
const CORNERS: Array<[string, string]> = [['top-left', 'Top left'], ['top-right', 'Top right'], ['bottom-left', 'Bottom left'], ['bottom-right', 'Bottom right']]
const MAX_WIDTH = 620
const TAP_SLOP = 8

let workerStarted = false
async function pdfjs() {
  const lib = await import('pdfjs-dist')
  if (!workerStarted) {
    workerStarted = true
    lib.GlobalWorkerOptions.workerPort = new Worker(new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url), { type: 'module' })
  }
  return lib
}

/** The placement a person confirmed, as it is stored and signed: the same fractions the PDF uses. */
export interface ConfirmedPlacement { pages: Mode; page_number: number | null; corner: string; size: 'small' | 'medium'; pos_x: string | null; pos_y: string | null }

export function SealPlacer({ recordId, initial, verifyUrl, lang = 'id', sourceUrl, signer, documentNumber, signatureType = 2, onPlacement }: {
  recordId?: number; initial: Record<string, string>; verifyUrl: string; lang?: Lang
  /** Where to fetch the PDF to show (the signing ceremony shows the exact file being signed). */
  sourceUrl?: string
  /** A personal signing: the preview shows the signer's name and position; otherwise VORA's registration of the file (the company as the issuer). */
  signer?: { name: string; position: string }
  /** The document's number when it has one (a draft that is not saved yet shows a placeholder). */
  documentNumber?: string
  /** Which signature component the policy gives this document: 1 for a regular VORA document, 2 for a third-party document or an agreement. */
  signatureType?: SignatureType
  /** Called with the placement when it is confirmed, and with null when it is changed again. */
  onPlacement?: (p: ConfirmedPlacement | null) => void
}) {
  const typed = (name: string, fallback: string) => useTypedValue(name, initial[name] ?? fallback)   // eslint-disable-line react-hooks/rules-of-hooks
  const [mode, setMode] = useState<Mode>(typed('pages', 'last') as Mode)
  const [pageNumber, setPageNumber] = useState(Number.parseInt(typed('page_number', '1'), 10) || 1)
  const [corner, setCorner] = useState(typed('corner', 'bottom-right'))
  const [size, setSize] = useState(typed('size', 'medium'))
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: Number(typed('pos_x', '0.6')) || 0.6, y: Number(typed('pos_y', '0.85')) || 0.85 })
  const [confirmed, setConfirmed] = useState(initial.placement_confirmed === 'yes')
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [pages, setPages] = useState(0)
  const [view, setView] = useState(1)
  const [zoom, setZoom] = useState(1)
  const [bigSteps, setBigSteps] = useState(false)
  const [state, setState] = useState<'empty' | 'loading' | 'ready' | 'failed'>(recordId || sourceUrl ? 'loading' : 'empty')
  const [box, setBox] = useState<PageBox>({ pw: 595.28, ph: 841.89, cssW: MAX_WIDTH })
  const [avail, setAvail] = useState(0)
  const [finger, setFinger] = useState<{ x: number; y: number } | null>(null)
  const [moved, setMoved] = useState('')
  const root = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const drag = useRef<{ hold: { x: number; y: number }; touch: boolean } | null>(null)
  const tap = useRef<{ x: number; y: number; t: number; id: number } | null>(null)
  const loadId = useRef(0)

  const markInput = useMemo(() => ({ type: signatureType, lang, url: verifyUrl, size, number: documentNumber ?? (lang === 'id' ? '(nomor ditetapkan saat diterbitkan)' : '(number assigned on issue)'), preview: true, signer }), [signatureType, lang, verifyUrl, size, documentNumber, signer])
  const dims = useMemo(() => sealDims(markInput), [markInput])
  const layout = useMemo(() => layoutSignature(sealMarkOptions(markInput)), [markInput])

  const load = useCallback(async (data: ArrayBuffer) => {
    const id = ++loadId.current
    setState('loading')
    try {
      const lib = await pdfjs()
      const loaded = await lib.getDocument({ data: new Uint8Array(data) }).promise
      if (id !== loadId.current) { void loaded.destroy(); return }
      setDoc((old) => { void old?.destroy(); return loaded })
      setPages(loaded.numPages); setView(1); setState('ready')
    } catch { if (id === loadId.current) setState('failed') }
  }, [])

  // The file chosen in the form, or (editing a draft) the one already stored; and the meaning chosen in the form, which the mark states.
  useEffect(() => {
    const form = root.current?.closest('form')
    const input = form?.querySelector<HTMLInputElement>('input[name=source_pdf]')
    const onChange = async () => { const f = input?.files?.[0]; if (f) await load(await f.arrayBuffer()); else if (!recordId) { setDoc(null); setState('empty') } }
    input?.addEventListener('change', onChange)
    if (sourceUrl) fetch(sourceUrl).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('source')))).then(load).catch(() => setState('failed'))
    else if (recordId && !input?.files?.length) fetch(`/admin/documents/${recordId}/source`).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('source')))).then(load).catch(() => setState('failed'))
    return () => input?.removeEventListener('change', onChange)
  }, [recordId, load, sourceUrl])

  // The page is drawn as wide as the column allows, and again when the window changes (a phone turned sideways, a resized window).
  useEffect(() => {
    const el = root.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const watch = new ResizeObserver(() => setAvail(Math.floor(el.getBoundingClientRect().width)))
    watch.observe(el)
    return () => watch.disconnect()
  }, [])

  useEffect(() => {
    if (!pages) return
    if (mode === 'first') setView(1)
    else if (mode === 'last') setView(pages)
    else if (mode === 'one') setView(Math.min(Math.max(pageNumber, 1), pages))
  }, [mode, pageNumber, pages])

  // Draw the page being shown. The bitmap is scaled by the device pixel ratio; the overlay is in CSS pixels and is not.
  useEffect(() => {
    if (!doc || !canvas.current) return
    let task: RenderTask | undefined
    let stale = false
    ;(async () => {
      const page = await doc.getPage(Math.min(view, doc.numPages))
      const natural = page.getViewport({ scale: 1 })                      // rotation and crop box are applied: this is the page as a reader sees it
      const cssW = Math.max(240, Math.min(MAX_WIDTH, avail || MAX_WIDTH)) * zoom
      const scale = cssW / natural.width
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const viewport = page.getViewport({ scale: scale * dpr })
      const c = canvas.current!
      c.width = Math.floor(viewport.width); c.height = Math.floor(viewport.height)
      c.style.width = `${cssW}px`; c.style.height = `${natural.height * scale}px`
      if (stale) return
      setBox({ pw: natural.width, ph: natural.height, cssW })
      task = page.render({ canvasContext: c.getContext('2d')!, viewport })
      await task.promise.catch(() => undefined)
    })().catch(() => { if (!stale) setState('failed') })
    return () => { stale = true; task?.cancel() }
  }, [doc, view, avail, zoom])

  const rect = cssRect(box, dims, corner, pos)
  const scale = scaleOf(box)
  const carries = mode === 'all' || (mode === 'first' && view === 1) || (mode === 'last' && view === pages) || (mode === 'one' && view === pageNumber)

  const place = (next: { x: number; y: number }) => {
    setPos(next); setCorner('custom'); setConfirmed(false)
    setMoved(describePlacement(view, next).en)
  }
  const pointer = (e: PointerEvent) => { const r = stage.current!.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top } }
  const onMark = (e: PointerEvent) => Boolean((e.target as Element).closest('.seal-box'))

  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const p = pointer(e)
    const touch = e.pointerType !== 'mouse'
    if (onMark(e)) {
      stage.current!.setPointerCapture(e.pointerId)
      drag.current = { hold: { x: p.x - rect.left, y: p.y - rect.top }, touch }
      if (touch) setFinger({ x: e.clientX, y: e.clientY })
      return
    }
    if (!touch) {                                                         // a click places the mark there, centred, and the same press can go on to drag it
      const next = tapTo(box, dims, p)
      place(next)
      stage.current!.setPointerCapture(e.pointerId)
      drag.current = { hold: { x: (dims.w * scale) / 2, y: (dims.h * scale) / 2 }, touch: false }
      return
    }
    tap.current = { x: e.clientX, y: e.clientY, t: Date.now(), id: e.pointerId }   // a touch outside the mark may be a scroll: it is a tap only if it stays put
  }
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (tap.current && tap.current.id === e.pointerId && Math.hypot(e.clientX - tap.current.x, e.clientY - tap.current.y) > TAP_SLOP) tap.current = null
    if (!drag.current) return
    place(dragTo(box, dims, pointer(e), drag.current.hold))
    if (drag.current.touch) setFinger({ x: e.clientX, y: e.clientY })
  }
  const up = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current) { drag.current = null; setFinger(null); return }
    const t = tap.current
    tap.current = null
    if (t && t.id === e.pointerId && Date.now() - t.t < 600) place(tapTo(box, dims, pointer(e)))
  }
  const cancel = () => { drag.current = null; tap.current = null; setFinger(null) }

  const step = bigSteps ? 10 : 2
  const move_ = (dx: number, dy: number) => place(nudge(box, dims, currentFractions(), dx, dy))
  const currentFractions = () => (corner === 'custom' ? pos : { x: rect.left / (box.pw * scale), y: rect.top / (box.ph * scale) })
  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    const s = e.shiftKey ? 12 : 2
    const d = { ArrowLeft: [-s, 0], ArrowRight: [s, 0], ArrowUp: [0, -s], ArrowDown: [0, s] }[e.key]
    if (!d) return
    e.preventDefault()
    move_(d[0], d[1])
  }
  const reset = () => { setCorner('bottom-right'); setPos({ x: 0.6, y: 0.85 }); setConfirmed(false); setMoved('') }
  const snap = (c: string) => { setCorner(c); setConfirmed(false); setMoved('') }

  const finalPos = corner === 'custom' ? pos : { x: rect.left / (box.pw * scale), y: rect.top / (box.ph * scale) }
  useEffect(() => {
    onPlacement?.(confirmed ? { pages: mode, page_number: mode === 'one' ? Math.min(Math.max(pageNumber, 1), pages || pageNumber) : null, corner, size: size === 'small' ? 'small' : 'medium', pos_x: corner === 'custom' ? finalPos.x.toFixed(4) : null, pos_y: corner === 'custom' ? finalPos.y.toFixed(4) : null } : null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmed, mode, pageNumber, corner, size, finalPos.x, finalPos.y])
  const loupeSize = { w: Math.min(280, typeof window === 'undefined' ? 280 : window.innerWidth - 16), h: 0 }
  loupeSize.h = loupeSize.w * (dims.h / dims.w)
  const loupe = finger && typeof document !== 'undefined' ? loupePosition(finger, { width: window.innerWidth, height: window.innerHeight }, loupeSize) : null

  return (
    <div className="seal-placer wide" ref={root} style={{ gridColumn: '1 / -1' }}>
      <h4 style={{ margin: '14px 0 6px' }}>{signer ? 'Where your signing mark goes' : 'Where the VORA mark goes'}</h4>
      <input type="hidden" name="pages" value={mode} /><input type="hidden" name="page_number" value={mode === 'one' ? String(Math.min(Math.max(pageNumber, 1), pages || pageNumber)) : ''} />
      <input type="hidden" name="corner" value={corner} /><input type="hidden" name="size" value={size} />
      <input type="hidden" name="pos_x" value={finalPos.x.toFixed(4)} /><input type="hidden" name="pos_y" value={finalPos.y.toFixed(4)} />
      <input type="hidden" name="placement_confirmed" value={confirmed ? 'yes' : ''} />
      <div className="seal-controls">
        <fieldset><legend>Pages that carry the mark</legend>
          {([['first', 'First page'], ['last', 'Last page'], ['all', 'Every page'], ['one', 'One page']] as Array<[Mode, string]>).map(([v, l]) => (
            <label key={v}><input type="radio" name="seal_pages_ui" checked={mode === v} onChange={() => { setMode(v); setConfirmed(false); if (v === 'one') setPageNumber(view) }} /> {l}</label>
          ))}
        </fieldset>
        <fieldset><legend>Size</legend>
          {([['medium', 'Medium'], ['small', 'Small']] as const).map(([v, l]) => <label key={v}><input type="radio" name="seal_size_ui" checked={size === v} onChange={() => { setSize(v); setConfirmed(false) }} /> {l}</label>)}
        </fieldset>
        <fieldset><legend>Snap to a corner</legend>
          <div className="seal-corners">{CORNERS.map(([v, l]) => <button key={v} type="button" className={corner === v ? 'button' : 'button-outline'} aria-pressed={corner === v} onClick={() => snap(v)}>{l}</button>)}</div>
        </fieldset>
      </div>
      {state === 'empty' ? <p className="note mini">Choose the PDF above and its pages appear here. Then tap or click where the mark should go, or drag it. This is a preview: the mark is final only when the document is issued.</p> : null}
      {state === 'loading' ? <p className="note mini" role="status">Loading the pages...</p> : null}
      {state === 'failed' ? <p className="note mini" role="alert">The pages could not be shown here. The mark can still be snapped to a corner, and the preview PDF after saving shows the result.</p> : null}
      {state === 'ready' ? (
        <>
          <div className="seal-pager">
            <button type="button" className="button-outline" onClick={() => { const v = Math.max(1, view - 1); setView(v); if (mode === 'one') { setPageNumber(v); setConfirmed(false) } }} disabled={view <= 1}>Previous page</button>
            <span aria-live="polite">Page {view} of {pages}{carries ? ' · carries the mark' : ' · no mark on this page'}</span>
            <button type="button" className="button-outline" onClick={() => { const v = Math.min(pages, view + 1); setView(v); if (mode === 'one') { setPageNumber(v); setConfirmed(false) } }} disabled={view >= pages}>Next page</button>
          </div>
          <div className="seal-toolbar" role="group" aria-label="Zoom and position">
            <button type="button" className="button-outline" onClick={() => setZoom((z) => clampZoom(z - 0.25))} disabled={zoom <= 1} aria-label="Zoom out">−</button>
            <span className="mini" aria-live="polite">{Math.round(zoom * 100)}%</span>
            <button type="button" className="button-outline" onClick={() => setZoom((z) => clampZoom(z + 0.25))} disabled={zoom >= 3} aria-label="Zoom in">+</button>
            <span className="seal-nudge" role="group" aria-label="Fine adjustment">
              <button type="button" className="button-outline" onClick={() => move_(-step, 0)} aria-label="Move left">←</button>
              <button type="button" className="button-outline" onClick={() => move_(0, -step)} aria-label="Move up">↑</button>
              <button type="button" className="button-outline" onClick={() => move_(0, step)} aria-label="Move down">↓</button>
              <button type="button" className="button-outline" onClick={() => move_(step, 0)} aria-label="Move right">→</button>
            </span>
            <label className="mini"><input type="checkbox" checked={bigSteps} onChange={(e) => setBigSteps(e.target.checked)} /> Larger steps</label>
            <button type="button" className="button-outline" onClick={reset}>Reset</button>
          </div>
          <div className="seal-scroll">
            <div className="seal-stage" ref={stage} style={{ width: box.cssW }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel} data-testid="seal-stage">
              <canvas ref={canvas} aria-label={`Page ${view} of the PDF`} />
              <div className={`seal-box${drag.current ? ' is-dragging' : ''}${confirmed ? ' is-confirmed' : ''}`} role="button" tabIndex={0} data-testid="seal-box"
                aria-label="VORA verification mark, preview. Drag it, or use the arrow keys to move it. Shift makes the steps bigger."
                style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height, touchAction: 'none' }} onKeyDown={key}>
                <TrustMark layout={layout} url={verifyUrl} title="Preview of the VORA verification mark" />
              </div>
            </div>
          </div>
          <div className="seal-confirm">
            <button type="button" className={confirmed ? 'button-outline' : 'button'} onClick={() => setConfirmed(true)} aria-pressed={confirmed} data-testid="seal-confirm">{confirmed ? 'Placement confirmed ✓' : 'Confirm placement'}</button>
            <p className="mini muted" role="status" aria-live="polite" data-testid="seal-status">
              {confirmed ? `Confirmed - ${describePlacement(view, finalPos).en} (${describePlacement(view, finalPos).id}). The issued PDF puts the mark exactly there.` : moved || 'Tap or click the page, or drag the mark. Then confirm the placement.'}
            </p>
          </div>
        </>
      ) : null}
      {loupe ? createPortal(
        <div className="seal-loupe" aria-hidden="true" data-testid="seal-loupe" data-side={loupe.side} style={{ left: loupe.left, top: loupe.top, width: loupeSize.w, height: loupeSize.h }}>
          <TrustMark layout={layout} url={verifyUrl} />
        </div>, document.body) : null}
    </div>
  )
}
