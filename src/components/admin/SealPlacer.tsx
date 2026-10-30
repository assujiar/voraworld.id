'use client'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { useTypedValue } from '@/components/admin/ActionForm'
import { placeSeal, SEAL_SIZES } from '@/content/seal-layout'

/**
 * Where the VORA seal goes. The PDF is shown page by page (drawn in this browser by PDF.js: the file is not sent anywhere for this), and the seal is a box
 * that is dragged onto the page, with a finger, a mouse or the arrow keys. The box is placed by the same function the server uses to make the sealed
 * file (content/seal-layout.ts), so what is shown is what is made. The corner buttons still snap the seal into a corner. The choices travel with the form
 * as hidden fields.
 */
type Mode = 'first' | 'last' | 'all' | 'one'
const CORNERS: Array<[string, string]> = [['top-left', 'Top left'], ['top-right', 'Top right'], ['bottom-left', 'Bottom left'], ['bottom-right', 'Bottom right']]
const MAX_WIDTH = 560

let workerStarted = false
async function pdfjs() {
  const lib = await import('pdfjs-dist')
  if (!workerStarted) {
    workerStarted = true
    lib.GlobalWorkerOptions.workerPort = new Worker(new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url), { type: 'module' })
  }
  return lib
}

export function SealPlacer({ recordId, initial }: { recordId?: number; initial: Record<string, string> }) {
  const typed = (name: string, fallback: string) => useTypedValue(name, initial[name] ?? fallback)   // eslint-disable-line react-hooks/rules-of-hooks
  const [mode, setMode] = useState<Mode>(typed('pages', 'last') as Mode)
  const [pageNumber, setPageNumber] = useState(Number.parseInt(typed('page_number', '1'), 10) || 1)
  const [corner, setCorner] = useState(typed('corner', 'bottom-right'))
  const [size, setSize] = useState(typed('size', 'medium'))
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: Number(typed('pos_x', '0.6')) || 0.6, y: Number(typed('pos_y', '0.85')) || 0.85 })
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [pages, setPages] = useState(0)
  const [view, setView] = useState(1)
  const [state, setState] = useState<'empty' | 'loading' | 'ready' | 'failed'>(recordId ? 'loading' : 'empty')
  const [box, setBox] = useState({ pw: 595.28, ph: 841.89, cssW: MAX_WIDTH })
  const [avail, setAvail] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const drag = useRef<{ dx: number; dy: number } | null>(null)
  const [moved, setMoved] = useState('')
  const loadId = useRef(0)

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

  // The file chosen in the form, or (editing a draft) the one already stored.
  useEffect(() => {
    const input = root.current?.closest('form')?.querySelector<HTMLInputElement>('input[name=source_pdf]')
    const onChange = async () => { const f = input?.files?.[0]; if (f) await load(await f.arrayBuffer()); else if (!recordId) { setDoc(null); setState('empty') } }
    input?.addEventListener('change', onChange)
    if (recordId && !input?.files?.length) fetch(`/admin/documents/${recordId}/source`).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('source')))).then(load).catch(() => setState('failed'))
    return () => input?.removeEventListener('change', onChange)
  }, [recordId, load])

  // The page is drawn as wide as the column allows (a phone is narrower than a desktop), and again when the window changes.
  useEffect(() => {
    const el = root.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const watch = new ResizeObserver(() => setAvail(Math.floor(el.getBoundingClientRect().width)))
    watch.observe(el)
    return () => watch.disconnect()
  }, [])

  // Which page is shown follows what was chosen.
  useEffect(() => {
    if (!pages) return
    if (mode === 'first') setView(1)
    else if (mode === 'last') setView(pages)
    else if (mode === 'one') setView(Math.min(Math.max(pageNumber, 1), pages))
  }, [mode, pageNumber, pages])

  // Draw the page being shown.
  useEffect(() => {
    if (!doc || !canvas.current) return
    let task: RenderTask | undefined
    let stale = false
    ;(async () => {
      const page = await doc.getPage(Math.min(view, doc.numPages))
      const natural = page.getViewport({ scale: 1 })                      // rotation is applied: this is the page as a reader sees it
      const cssW = Math.max(240, Math.min(MAX_WIDTH, avail || MAX_WIDTH))
      const scale = cssW / natural.width
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const viewport = page.getViewport({ scale: scale * dpr })
      const c = canvas.current!
      c.width = Math.floor(viewport.width); c.height = Math.floor(viewport.height)
      c.style.width = `${cssW}px`; c.style.height = `${(natural.height * scale)}px`
      if (stale) return
      setBox({ pw: natural.width, ph: natural.height, cssW })
      task = page.render({ canvasContext: c.getContext('2d')!, viewport })
      await task.promise.catch(() => undefined)
    })().catch(() => { if (!stale) setState('failed') })
    return () => { stale = true; task?.cancel() }
  }, [doc, view, avail])

  const scale = box.cssW / box.pw
  const posX = corner === 'custom' ? pos.x : null, posY = corner === 'custom' ? pos.y : null
  const rect = placeSeal(box.pw, box.ph, size, corner, posX, posY)
  const cssLeft = rect.left * scale, cssTop = (box.ph - rect.bottom - rect.h) * scale

  /** Puts the seal's top left at a point of the page (CSS pixels from the page's top left), kept inside the page by the same rule the server uses. */
  const moveTo = (left: number, top: number) => {
    const r = placeSeal(box.pw, box.ph, size, 'custom', left / box.cssW, top / (box.ph * scale))
    setPos({ x: r.left / box.pw, y: (box.ph - r.bottom - r.h) / box.ph })
    setCorner('custom')
    setMoved(`Seal placed ${Math.round((r.left / box.pw) * 100)}% from the left and ${Math.round(((box.ph - r.bottom - r.h) / box.ph) * 100)}% from the top`)
  }
  const down = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    const r = e.currentTarget.getBoundingClientRect()
    drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top }
  }
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current || !canvas.current) return
    const c = canvas.current.getBoundingClientRect()
    moveTo(e.clientX - c.left - drag.current.dx, e.clientY - c.top - drag.current.dy)
  }
  const up = () => { drag.current = null }
  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = (e.shiftKey ? 20 : 4)
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key]
    if (!d) return
    e.preventDefault()
    moveTo(cssLeft + d[0], cssTop + d[1])
  }

  const dims = SEAL_SIZES[size] ?? SEAL_SIZES.medium
  return (
    <div className="seal-placer wide" ref={root} style={{ gridColumn: '1 / -1' }}>
      <h4 style={{ margin: '14px 0 6px' }}>Where the seal goes</h4>
      <input type="hidden" name="pages" value={mode} /><input type="hidden" name="page_number" value={mode === 'one' ? String(Math.min(Math.max(pageNumber, 1), pages || pageNumber)) : ''} />
      <input type="hidden" name="corner" value={corner} /><input type="hidden" name="size" value={size} />
      <input type="hidden" name="pos_x" value={pos.x.toFixed(4)} /><input type="hidden" name="pos_y" value={pos.y.toFixed(4)} />
      <div className="seal-controls">
        <fieldset><legend>Pages that carry the seal</legend>
          {([['first', 'First page'], ['last', 'Last page'], ['all', 'Every page'], ['one', 'One page']] as Array<[Mode, string]>).map(([v, l]) => (
            <label key={v}><input type="radio" name="seal_pages_ui" checked={mode === v} onChange={() => { setMode(v); if (v === 'one') setPageNumber(view) }} /> {l}</label>
          ))}
        </fieldset>
        <fieldset><legend>Size</legend>
          {([['medium', 'Medium (with details)'], ['small', 'Small']] as const).map(([v, l]) => <label key={v}><input type="radio" name="seal_size_ui" checked={size === v} onChange={() => setSize(v)} /> {l}</label>)}
        </fieldset>
        <fieldset><legend>Snap to a corner</legend>
          <div className="seal-corners">{CORNERS.map(([v, l]) => <button key={v} type="button" className={corner === v ? 'button' : 'button-outline'} aria-pressed={corner === v} onClick={() => setCorner(v)}>{l}</button>)}</div>
        </fieldset>
      </div>
      {state === 'empty' ? <p className="note mini">Choose the PDF above and its pages appear here. Then drag the seal to where it should go, or use the arrow keys when it is focused.</p> : null}
      {state === 'loading' ? <p className="note mini" role="status">Loading the pages...</p> : null}
      {state === 'failed' ? <p className="note mini" role="alert">The pages could not be shown here. The seal can still be snapped to a corner, and the preview PDF after saving shows the result.</p> : null}
      {state === 'ready' ? (
        <>
          <div className="seal-pager">
            <button type="button" className="button-outline" onClick={() => { const v = Math.max(1, view - 1); setView(v); if (mode === 'one') setPageNumber(v) }} disabled={view <= 1}>Previous page</button>
            <span aria-live="polite">Page {view} of {pages}{mode === 'all' || (mode === 'first' && view === 1) || (mode === 'last' && view === pages) || (mode === 'one' && view === pageNumber) ? ' · carries the seal' : ' · no seal on this page'}</span>
            <button type="button" className="button-outline" onClick={() => { const v = Math.min(pages, view + 1); setView(v); if (mode === 'one') setPageNumber(v) }} disabled={view >= pages}>Next page</button>
          </div>
          <div className="seal-stage" style={{ width: box.cssW }}>
            <canvas ref={canvas} aria-label={`Page ${view} of the PDF`} />
            <div className={`seal-box${drag.current ? ' is-dragging' : ''}`} role="button" tabIndex={0} aria-label="VORA seal. Drag it, or use the arrow keys to move it. Shift makes the steps bigger."
              style={{ left: cssLeft, top: cssTop, width: dims.w * scale, height: dims.h * scale, touchAction: 'none', fontSize: Math.max(7, dims.text * scale * 1.15) }}
              onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onKeyDown={key}>
              <span className="seal-qr" aria-hidden="true" /><span className="seal-lines" aria-hidden="true"><b>VORA DIGITAL SEAL</b><i /><i /><i /></span>
            </div>
          </div>
          <p className="mini muted" role="status" aria-live="polite">{moved || 'Drag the seal onto the page. The sealed PDF puts it exactly there.'}</p>
        </>
      ) : null}
    </div>
  )
}
