'use client'
import { useEffect, useRef, useState } from 'react'

const MAX_PHOTOS = 4
const PHOTO_SIDE = 1280
const PHOTO_BYTES = 450_000
const SIGNATURE = { w: 600, h: 220 }

type Where = { status: 'idle' } | { status: 'asking' } | { status: 'captured'; latitude: number; longitude: number; accuracy: number } | { status: 'unavailable'; note: string }

/** A photo reduced on the phone to a JPEG small enough to send (the server accepts at most 4.5 MB per request). */
async function reduce(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, PHOTO_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  let quality = 0.78, url = canvas.toDataURL('image/jpeg', quality)
  while (url.length * 0.75 > PHOTO_BYTES && quality > 0.35) { quality -= 0.1; url = canvas.toDataURL('image/jpeg', quality) }
  if (url.length * 0.75 > PHOTO_BYTES * 2) throw new Error('This photo is too large to send: take it again')
  return url
}

/**
 * Sends the proof and reports what is really happening: how many bytes of the request have left the phone, and when all of them have (from then on
 * the server is storing the evidence and recording the receipt, which this page cannot see into more finely than that).
 */
function sendProof(url: string, body: string, onSent: (percent: number) => void, onAllSent: () => void): Promise<{ status: number; json: { ok?: boolean; error?: string; at?: string; receiver?: string } | null }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)
    xhr.setRequestHeader('content-type', 'application/json')
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onSent(Math.min(100, Math.floor((e.loaded / e.total) * 100))) }
    xhr.upload.onload = onAllSent
    xhr.onerror = () => reject(new Error('Koneksi terputus, jadi belum pasti apakah bukti sampai ke server.'))
    xhr.ontimeout = xhr.onerror
    xhr.onload = () => { let json = null; try { json = JSON.parse(xhr.responseText) } catch { /* not JSON: the status says what happened */ } resolve({ status: xhr.status, json }) }
    xhr.send(body)
  })
}

/** Filled in by the driver or courier at the handover, on their own phone; the receiver gives their name and signs on this screen. */
export function PodForm({ token, number, driverName, driverPhone }: { token: string; number: string; driverName: string; driverPhone: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [signed, setSigned] = useState(false)
  const [photos, setPhotos] = useState<string[]>([])
  const [where, setWhere] = useState<Where>({ status: 'idle' })
  const [condition, setCondition] = useState('good')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [sentOnce, setSentOnce] = useState(false)                                          // a send reached (or tried to reach) the server and was not recorded
  const [stage, setStage] = useState<{ step: 'checking' | 'sending' | 'saving'; percent?: number } | null>(null)
  const [done, setDone] = useState<{ at: string; receiver: string } | null>(null)

  useEffect(() => {
    const c = canvas.current
    if (!c) return
    const g = c.getContext('2d')!
    g.lineWidth = 3; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#101720'
  }, [])

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * SIGNATURE.w, y: ((e.clientY - r.top) / r.height) * SIGNATURE.h }
  }
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    drawing.current = true
    const g = e.currentTarget.getContext('2d')!, p = point(e)
    g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x + 0.1, p.y + 0.1); g.stroke()
  }
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return
    const g = e.currentTarget.getContext('2d')!, p = point(e)
    g.lineTo(p.x, p.y); g.stroke(); setSigned(true)
  }
  const up = () => { drawing.current = false }
  const clear = () => { const c = canvas.current!; c.getContext('2d')!.clearRect(0, 0, c.width, c.height); setSigned(false) }

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return
    setError('')
    try {
      const next = [...photos]
      for (const f of Array.from(files)) { if (next.length >= MAX_PHOTOS) break; next.push(await reduce(f)) }
      setPhotos(next)
    } catch (e) { setError(e instanceof Error ? e.message : 'This photo could not be read: take it again') }
  }

  /** Reads the phone's position now. The location is required: the delivery is recorded only with it. */
  const locate = () => new Promise<Extract<Where, { status: 'captured' }> | null>((resolve) => {
    if (!navigator.geolocation) { setWhere({ status: 'unavailable', note: 'This phone cannot give its location' }); resolve(null); return }
    setWhere({ status: 'asking' })
    navigator.geolocation.getCurrentPosition(
      (p) => { const here = { status: 'captured' as const, latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy }; setWhere(here); resolve(here) },
      (e) => { setWhere({ status: 'unavailable', note: e.code === 1 ? 'Location access is blocked for this page' : 'The location could not be read' }); resolve(null) },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    )
  })
  useEffect(() => { void locate() }, [])

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    const f = new FormData(e.currentTarget)
    if (!signed) { setError('Sign in the box before sending'); return }
    if (!photos.length) { setError('Take at least one photo of the goods'); return }
    setBusy(true); setStage({ step: 'checking' })                                       // true: the location is read again now, it must be on at the moment of sending
    const loc = await locate()
    if (!loc) { setBusy(false); setStage(null); setError('Turn on the location of your phone and allow it for this page, then press Send again. The delivery cannot be recorded without it.'); return }
    const body = {
      courierName: f.get('courierName'), courierPhone: f.get('courierPhone'),
      receiverName: f.get('receiverName'), receiverPosition: f.get('receiverPosition'), receiverPhone: f.get('receiverPhone'), receiverEmail: f.get('receiverEmail'),
      receiverIdNumber: f.get('receiverIdNumber'), condition, conditionNote: f.get('conditionNote'),
      signature: canvas.current!.toDataURL('image/png'), photos,
      locationStatus: 'captured', latitude: String(loc.latitude), longitude: String(loc.longitude), accuracy: String(loc.accuracy), locationNote: '',
      deviceTime: new Date().toISOString(),
    }
    setStage({ step: 'sending', percent: 0 })
    try {
      const res = await sendProof(`/pod/${token}/submit`, JSON.stringify(body), (percent) => setStage({ step: 'sending', percent }), () => setStage({ step: 'saving' }))
      const out = res.json
      if (res.status < 200 || res.status >= 300 || !out?.ok) {
        const known = out?.error || (res.status === 413 ? 'Foto terlalu besar untuk dikirim. Ambil foto baru.' : 'Bukti pengiriman belum berhasil dikirim.')
        throw new Error(res.status === 409 && /already been recorded/.test(known) ? 'Penerimaan barang ini sudah tercatat sebelumnya, jadi tidak perlu dikirim lagi. Hubungi admin VORA bila ini keliru.' : `${known} Bukti pengiriman belum tercatat.`)
      }
      setDone({ at: out.at ?? '', receiver: out.receiver ?? '' })
    } catch (err) {
      setSentOnce(true)
      setError(`${err instanceof Error ? err.message : 'Bukti pengiriman belum berhasil dikirim.'} Isian, tanda tangan, foto, dan lokasi Anda masih ada: tekan "Kirim ulang" untuk mencoba lagi.`)
    } finally { setBusy(false); setStage(null) }
  }

  if (done) {
    return (
      <div role="status" className="note" style={{ marginTop: 18 }}>
        <strong>Thank you. The delivery of {number} has been recorded.</strong><br />
        Diterima oleh {done.receiver}{done.at ? ` pada ${new Date(done.at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB` : ''}. You can close this page.
      </div>
    )
  }

  const stageText = stage?.step === 'checking' ? 'Memeriksa data…'
    : stage?.step === 'sending' ? `Mengunggah tanda tangan dan foto… ${stage.percent ?? 0}%`
    : stage?.step === 'saving' ? 'Menyimpan bukti dan mencatat penerimaan…' : ''
  const field = { style: { display: 'block', width: '100%', minHeight: 44, fontSize: 16 } } as const
  return (
    <form onSubmit={submit} style={{ marginTop: 22 }} noValidate>
      <h2 style={{ fontSize: '1.2rem' }}>Record the delivery / Catat pengiriman</h2>
      <p className="mini muted">For the driver or courier, at the handover. Fill this in on your phone and let the receiver sign on the screen.</p>
      {error ? <div className="alert" role="alert">{error}</div> : null}
      <h3 style={{ fontSize: '1rem', margin: '16px 0 4px' }}>You: driver / courier <small className="muted">(Pengantar)</small></h3>
      <div className="field"><label htmlFor="courierName">Your full name / Nama lengkap Anda *</label><input id="courierName" name="courierName" autoComplete="name" required maxLength={160} defaultValue={driverName} {...field} /></div>
      <div className="field"><label htmlFor="courierPhone">Your phone / Telepon Anda *</label><input id="courierPhone" name="courierPhone" type="tel" autoComplete="tel" required maxLength={60} defaultValue={driverPhone} {...field} /></div>
      <h3 style={{ fontSize: '1rem', margin: '20px 0 4px' }}>The receiver <small className="muted">(Penerima)</small></h3>
      <div className="field"><label htmlFor="receiverName">Receiver&apos;s full name / Nama lengkap penerima *</label><input id="receiverName" name="receiverName" autoComplete="name" required maxLength={160} {...field} /></div>
      <div className="field"><label htmlFor="receiverPosition">Receiver&apos;s position / Jabatan penerima *</label><input id="receiverPosition" name="receiverPosition" required maxLength={160} {...field} /></div>
      <div className="field"><label htmlFor="receiverPhone">Receiver&apos;s phone / Telepon penerima *</label><input id="receiverPhone" name="receiverPhone" type="tel" autoComplete="tel" required maxLength={60} {...field} /></div>
      <div className="field"><label htmlFor="receiverEmail">Receiver&apos;s email (optional)</label><input id="receiverEmail" name="receiverEmail" type="email" autoComplete="email" maxLength={200} {...field} /></div>
      <div className="field"><label htmlFor="receiverIdNumber">Receiver&apos;s ID number / No. identitas (optional)</label><input id="receiverIdNumber" name="receiverIdNumber" maxLength={40} {...field} /></div>

      <fieldset className="field" style={{ border: 0, padding: 0, margin: '14px 0' }}>
        <legend style={{ fontWeight: 600 }}>Condition of the goods / Kondisi barang *</legend>
        {[['good', 'Good / Baik'], ['damaged', 'Damaged / Rusak'], ['partial', 'Partial / Sebagian']].map(([v, label]) => (
          <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, fontWeight: 400 }}>
            <input type="radio" name="condition" value={v} checked={condition === v} onChange={() => setCondition(v)} style={{ width: 22, height: 22 }} /> {label}
          </label>
        ))}
      </fieldset>
      <div className="field"><label htmlFor="conditionNote">{condition === 'good' ? 'Note (optional)' : 'What is damaged or missing? *'}</label><textarea id="conditionNote" name="conditionNote" rows={3} maxLength={1000} {...field} /></div>

      <div className="field">
        <label id="sig-label">Receiver&apos;s signature / Tanda tangan penerima * <small className="muted">(they sign here, on your screen)</small></label>
        <canvas ref={canvas} width={SIGNATURE.w} height={SIGNATURE.h} aria-labelledby="sig-label" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
          style={{ width: '100%', aspectRatio: `${SIGNATURE.w} / ${SIGNATURE.h}`, touchAction: 'none', background: '#fff', border: '1.5px dashed #8a959c', borderRadius: 10, cursor: 'crosshair' }} />
        <button type="button" className="button-outline" onClick={clear} style={{ minHeight: 44, marginTop: 8 }}>Clear signature</button>
      </div>

      <div className="field">
        <label htmlFor="photos">Photos of the goods / Foto barang * (1 to {MAX_PHOTOS})</label>
        <input id="photos" type="file" accept="image/*" capture="environment" multiple onChange={(e) => { void addPhotos(e.target.files); e.target.value = '' }} disabled={photos.length >= MAX_PHOTOS} {...field} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          {photos.map((p, i) => (
            <div key={i} style={{ position: 'relative' }}>
              <img src={p} alt={`Photo ${i + 1}`} style={{ height: 84, borderRadius: 8 }} />
              <button type="button" aria-label={`Remove photo ${i + 1}`} onClick={() => setPhotos(photos.filter((_, k) => k !== i))} style={{ position: 'absolute', top: -8, right: -8, width: 32, height: 32, borderRadius: 16, border: 0, background: '#101720', color: '#fff' }}>×</button>
            </div>
          ))}
        </div>
      </div>

      <div className="field">
        <label>Location of the delivery / Lokasi pengiriman * <small className="muted">(required)</small></label>
        <p className="mini muted" style={{ margin: '0 0 8px' }}>The location of your phone is recorded together with the time, to prove where the goods were delivered. Switch on the location of your phone and allow it for this page; the delivery cannot be recorded without it. / Aktifkan lokasi ponsel Anda dan izinkan untuk halaman ini.</p>
        {where.status === 'captured'
          ? <p role="status">Location on (accuracy about {Math.round(where.accuracy)} m).</p>
          : where.status === 'unavailable'
            ? <p className="alert" role="status">{where.note}. Turn on location in your phone settings and allow it for this page.</p>
            : <p role="status">Reading your location…</p>}
        <button type="button" className="button-outline" onClick={() => void locate()} disabled={where.status === 'asking'} style={{ minHeight: 44 }}>{where.status === 'captured' ? 'Read the location again' : 'Turn on / try the location again'}</button>
      </div>

      <button className="button" disabled={busy} aria-busy={busy} style={{ minHeight: 48, width: '100%', fontSize: 16 }}>
        {busy ? <><span className="spin" aria-hidden="true" /> {stageText}</> : sentOnce ? 'Kirim ulang / Send again' : 'Send proof of delivery / Kirim'}
      </button>
      {stage?.step === 'sending' ? <div role="progressbar" aria-label={stageText} aria-valuemin={0} aria-valuemax={100} aria-valuenow={stage.percent ?? 0} style={{ height: 4, background: '#e1e5e7', borderRadius: 2, marginTop: 6 }}><div style={{ height: 4, width: `${stage.percent ?? 0}%`, background: '#b43e31', borderRadius: 2, transition: 'width .15s linear' }} /></div> : null}
      <p className="mini muted" role="status" aria-live="polite" style={{ minHeight: 20 }}>{busy ? 'Jangan tutup halaman ini sampai ada konfirmasi.' : ''}</p>
      <p className="mini muted" style={{ marginTop: 10 }}>By sending, you confirm that you delivered the goods listed above to the person named as receiver. Names, the signature, photos and the time are recorded with VORA.</p>
    </form>
  )
}
