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

export function PodForm({ token, number }: { token: string; number: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [signed, setSigned] = useState(false)
  const [photos, setPhotos] = useState<string[]>([])
  const [where, setWhere] = useState<Where>({ status: 'idle' })
  const [condition, setCondition] = useState('good')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
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

  const share = () => {
    if (!navigator.geolocation) { setWhere({ status: 'unavailable', note: 'This phone cannot share its location' }); return }
    setWhere({ status: 'asking' })
    navigator.geolocation.getCurrentPosition(
      (p) => setWhere({ status: 'captured', latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy }),
      (e) => setWhere({ status: 'unavailable', note: e.code === 1 ? 'The receiver did not allow location access' : 'The location could not be read' }),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    )
  }

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    const f = new FormData(e.currentTarget)
    if (!signed) { setError('Sign in the box before sending'); return }
    if (!photos.length) { setError('Take at least one photo of the goods'); return }
    const loc = where.status === 'captured' ? where : null
    const body = {
      receiverName: f.get('receiverName'), receiverPosition: f.get('receiverPosition'), receiverPhone: f.get('receiverPhone'), receiverEmail: f.get('receiverEmail'),
      receiverIdNumber: f.get('receiverIdNumber'), condition, conditionNote: f.get('conditionNote'),
      signature: canvas.current!.toDataURL('image/png'), photos,
      locationStatus: loc ? 'captured' : 'unavailable', latitude: loc ? String(loc.latitude) : '', longitude: loc ? String(loc.longitude) : '', accuracy: loc ? String(loc.accuracy) : '',
      locationNote: where.status === 'unavailable' ? where.note : loc ? '' : 'Not shared by the receiver',
      deviceTime: new Date().toISOString(),
    }
    setBusy(true)
    try {
      const res = await fetch(`/pod/${token}/submit`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      const out = await res.json().catch(() => null) as { ok?: boolean; error?: string; at?: string; receiver?: string } | null
      if (!res.ok || !out?.ok) throw new Error(out?.error || (res.status === 413 ? 'The photos are too large to send: take them again' : 'The proof of delivery could not be sent: try again'))
      setDone({ at: out.at ?? '', receiver: out.receiver ?? '' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The proof of delivery could not be sent: try again')
    } finally { setBusy(false) }
  }

  if (done) {
    return (
      <div role="status" className="note" style={{ marginTop: 18 }}>
        <strong>Thank you. The receipt of {number} has been recorded.</strong><br />
        Diterima oleh {done.receiver}{done.at ? ` pada ${new Date(done.at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB` : ''}. You can close this page.
      </div>
    )
  }

  const field = { style: { display: 'block', width: '100%', minHeight: 44, fontSize: 16 } } as const
  return (
    <form onSubmit={submit} style={{ marginTop: 22 }} noValidate>
      <h2 style={{ fontSize: '1.2rem' }}>Confirm receipt / Konfirmasi penerimaan</h2>
      {error ? <div className="alert" role="alert">{error}</div> : null}
      <div className="field"><label htmlFor="receiverName">Your full name / Nama lengkap *</label><input id="receiverName" name="receiverName" autoComplete="name" required maxLength={160} {...field} /></div>
      <div className="field"><label htmlFor="receiverPosition">Position / Jabatan *</label><input id="receiverPosition" name="receiverPosition" required maxLength={160} {...field} /></div>
      <div className="field"><label htmlFor="receiverPhone">Phone / Telepon *</label><input id="receiverPhone" name="receiverPhone" type="tel" autoComplete="tel" required maxLength={60} {...field} /></div>
      <div className="field"><label htmlFor="receiverEmail">Email (optional)</label><input id="receiverEmail" name="receiverEmail" type="email" autoComplete="email" maxLength={200} {...field} /></div>
      <div className="field"><label htmlFor="receiverIdNumber">ID number / No. identitas (optional)</label><input id="receiverIdNumber" name="receiverIdNumber" maxLength={40} {...field} /></div>

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
        <label id="sig-label">Signature / Tanda tangan *</label>
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
        <label>Location (optional) / Lokasi (opsional)</label>
        <p className="mini muted" style={{ margin: '0 0 8px' }}>Sharing your location helps VORA confirm where the goods were received. Your phone will ask for permission; you may decline and still send this form. The time of receipt is always recorded.</p>
        {where.status === 'captured'
          ? <p role="status">Location captured (accuracy about {Math.round(where.accuracy)} m). <button type="button" className="button-outline" onClick={() => setWhere({ status: 'idle' })} style={{ minHeight: 44 }}>Do not share</button></p>
          : <button type="button" className="button-outline" onClick={share} disabled={where.status === 'asking'} style={{ minHeight: 44 }}>{where.status === 'asking' ? 'Reading your location…' : 'Share my location'}</button>}
        {where.status === 'unavailable' ? <p className="mini muted" role="status">{where.note}. You can still send this form.</p> : null}
      </div>

      <button className="button" disabled={busy} aria-busy={busy} style={{ minHeight: 48, width: '100%', fontSize: 16 }}>{busy ? 'Sending…' : 'Send proof of delivery / Kirim'}</button>
      <p className="mini muted" style={{ marginTop: 10 }}>By sending, you confirm that you received the goods listed above. Your name, signature, photos and the time are recorded with VORA.</p>
    </form>
  )
}
