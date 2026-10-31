import { CopyButtons } from '@/components/verify/CopyButtons'
import { Watermark } from '@/components/verify/Watermark'
import { FileCheck, type Recorded } from '@/components/site/FileCheck'
import { METHOD_LABEL } from '@/content/verify-labels'
import type { Banner, IssuanceFinding, VerifyModel } from '@/server/trust/verification-view'
import { PURPOSE_LABELS } from '@/content/trust-policy'

/** The official domain, a constant: nothing a visitor or a request supplies is ever shown as the domain of VORA's verification. */
export const OFFICIAL_DOMAIN = 'voraworld.id'

const Bi = ({ en, id }: { en: React.ReactNode; id: React.ReactNode }) => <>{en} <span className="vf-id" lang="id"><span className="vf-sep">| </span>{id}</span></>

const BANNERS: Record<Banner, { en: string; id: string; tone: 'info' | 'bad' | 'wait' | 'warn'; mark: string; note: { en: string; id: string } }> = {
  record_found: { en: 'ISSUANCE RECORD FOUND', id: 'CATATAN PENERBITAN DITEMUKAN', tone: 'info', mark: '●', note: { en: 'This is a record check. Read the separate findings below: a found record does not by itself show that a file in your hands is unmodified, or that anybody signed it.', id: 'Ini pemeriksaan catatan. Baca temuan terpisah di bawah: catatan yang ditemukan tidak dengan sendirinya menunjukkan bahwa berkas di tangan Anda tidak diubah, atau bahwa seseorang telah menandatanganinya.' } },
  draft: { en: 'DRAFT', id: 'BELUM DITANDATANGANI', tone: 'wait', mark: '◐', note: { en: 'This document has not been issued. Do not rely on it.', id: 'Dokumen ini belum diterbitkan. Jangan mengandalkannya.' } },
  revoked: { en: 'REVOKED', id: 'DICABUT', tone: 'bad', mark: '✕', note: { en: 'VORA has withdrawn this document. It must not be relied on.', id: 'VORA telah menarik dokumen ini. Dokumen ini tidak boleh dijadikan pegangan.' } },
  superseded: { en: 'SUPERSEDED', id: 'DIGANTIKAN', tone: 'bad', mark: '✕', note: { en: 'This document has been replaced by a newer one and must not be relied on.', id: 'Dokumen ini telah digantikan oleh dokumen yang lebih baru dan tidak boleh dijadikan pegangan.' } },
  pending_emeterai: { en: 'PENDING E-METERAI', id: 'MENUNGGU E-METERAI', tone: 'wait', mark: '◐', note: { en: 'The official e-meterai has not been applied yet, so the document has not been released.', id: 'E-meterai resmi belum dibubuhkan, sehingga dokumen belum dirilis.' } },
  awaiting_approval: { en: 'AWAITING APPROVAL', id: 'MENUNGGU PERSETUJUAN', tone: 'wait', mark: '◐', note: { en: 'VORA issued this document. The customer has not completed the approval yet.', id: 'VORA menerbitkan dokumen ini. Pelanggan belum menyelesaikan persetujuan.' } },
  not_fully_executed: { en: 'ISSUED, NOT FULLY EXECUTED', id: 'DITERBITKAN, BELUM TERLAKSANA PENUH', tone: 'warn', mark: '!', note: { en: 'Not every required party has signed yet. Do not treat the agreement as executed.', id: 'Belum semua pihak yang disyaratkan menandatangani. Jangan anggap perjanjian ini telah terlaksana.' } },
  incomplete: { en: 'VERIFICATION INCOMPLETE', id: 'VERIFIKASI BELUM LENGKAP', tone: 'warn', mark: '!', note: { en: 'One of the checks below did not pass. Do not rely on this document until VORA confirms it.', id: 'Salah satu pemeriksaan di bawah tidak lulus. Jangan mengandalkan dokumen ini sampai VORA mengonfirmasinya.' } },
  unavailable: { en: 'VERIFICATION UNAVAILABLE', id: 'VERIFIKASI TIDAK TERSEDIA', tone: 'warn', mark: '!', note: { en: 'The records could not be read right now. Try again shortly.', id: 'Catatan tidak dapat dibaca saat ini. Coba lagi sebentar lagi.' } },
}

const ISSUANCE: Record<IssuanceFinding, { en: string; id: string; tone: 'ok' | 'neutral' | 'bad'; detail: { en: string; id: string } }> = {
  verified: { en: 'Issuance attestation verified', id: 'Atestasi penerbitan terverifikasi', tone: 'ok', detail: { en: 'VORA\'s signature over the description of the issued file checks out against the public key listed below.', id: 'Tanda tangan VORA atas deskripsi berkas yang diterbitkan cocok dengan kunci publik yang tercantum di bawah.' } },
  invalid_signature: { en: 'Issuance attestation could not be verified', id: 'Atestasi penerbitan tidak dapat diverifikasi', tone: 'bad', detail: { en: 'The recorded attestation does not match the recorded file. Do not rely on this document.', id: 'Atestasi yang tercatat tidak cocok dengan berkas yang tercatat. Jangan mengandalkan dokumen ini.' } },
  key_compromised: { en: 'Attestation key reported compromised', id: 'Kunci atestasi dilaporkan terkompromi', tone: 'bad', detail: { en: 'The key that signed this attestation was withdrawn as compromised, so the attestation is not to be relied on.', id: 'Kunci yang menandatangani atestasi ini ditarik karena terkompromi, sehingga atestasi tidak boleh dijadikan pegangan.' } },
  not_attested: { en: 'Issuance recorded; no attestation available', id: 'Penerbitan tercatat; atestasi tidak tersedia', tone: 'neutral', detail: { en: 'The file is recorded with its fingerprint, but no attestation key was in service when it was issued.', id: 'Berkas tercatat beserta sidik jarinya, tetapi tidak ada kunci atestasi yang aktif saat diterbitkan.' } },
  legacy: { en: 'Issued before the verification system', id: 'Diterbitkan sebelum sistem verifikasi', tone: 'neutral', detail: { en: 'This document predates the archive and attestation. Only the record that VORA registered it exists: there is no archived file and no attestation, and none is claimed.', id: 'Dokumen ini lebih lama daripada arsip dan atestasi. Hanya catatan bahwa VORA mendaftarkannya yang ada: tidak ada berkas arsip dan tidak ada atestasi, dan tidak diklaim.' } },
  not_archived: { en: 'Issued; drawn from live records', id: 'Diterbitkan; dibuat dari catatan terkini', tone: 'neutral', detail: { en: 'This kind of document shows a status that changes, so its PDF is drawn from VORA\'s records each time and no single file is recorded. The current status below is read live.', id: 'Jenis dokumen ini menampilkan status yang berubah, sehingga PDF-nya dibuat dari catatan VORA setiap kali dan tidak ada satu berkas pun yang dicatat. Status terkini di bawah dibaca langsung.' } },
  not_issued: { en: 'Not issued', id: 'Belum diterbitkan', tone: 'neutral', detail: { en: 'There is nothing to attest yet.', id: 'Belum ada yang diatestasi.' } },
}

const when = (iso: string) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date(iso)) + ' WIB'

export function VerifyView({ model, token, origin, viewedAt }: { model: VerifyModel; token: string; origin: string; viewedAt: Date }) {
  const b = BANNERS[model.banner]
  const url = `${origin.replace(/\/+$/, '')}/verify/${token}`
  const issuance = ISSUANCE[model.issuance]
  const recorded: Recorded[] = [
    ...model.artifacts.map((a): Recorded => ({ sha256: a.sha256, kind: a.role, version: a.version })),
    ...(model.source ? [{ sha256: model.source.originalSha256, kind: 'original' as const }] : []),
  ]
  const live = model.banner !== 'revoked' && model.banner !== 'superseded'
  return (
    <main className="vf-page" data-banner={model.banner}>
      <Watermark layer="back" id="b" />
      <div className="vf-inner">
        <header className="vf-head">
          <a href="/en" aria-label="VORA"><img src="/static/assets/vora-primary.svg" alt="VORA" width={150} /></a>
          <div className="vf-head-text">
            <span className="vf-eyebrow">DOCUMENT VERIFICATION <span className="vf-id">| VERIFIKASI DOKUMEN</span></span>
            <span className="vf-entity">PT SATU ARAH INTERNATIONAL · {OFFICIAL_DOMAIN}</span>
          </div>
        </header>

        <section className={`vf-banner vf-${b.tone}`} aria-labelledby="vf-status">
          <span className="vf-mark" aria-hidden="true">{b.mark}</span>
          <div>
            <h1 id="vf-status">{b.en} <span className="vf-id" lang="id"><span className="vf-sep">| </span>{b.id}</span></h1>
            <p>{b.note.en}<br /><span className="vf-id">{b.note.id}</span></p>
            {model.revokedReason && !live ? <p className="vf-small">Reason: {model.revokedReason}</p> : null}
            {model.supersededBy ? <p><a className="vf-link" href={`/verify/${model.supersededBy.token}`}>See the document that replaces this one <span className="vf-id">| Lihat dokumen penggantinya</span></a></p> : null}
          </div>
        </section>

        <section className="vf-surface vf-ident" aria-label="Document">
          <dl>
            <div><dt><Bi en="Document" id={model.labelId} /></dt><dd>{model.label}</dd></div>
            <div><dt><Bi en="Reference" id="Nomor" /></dt><dd className="vf-mono">{model.reference}</dd></div>
            <div><dt><Bi en="Issuer" id="Penerbit" /></dt><dd>{model.issuer}</dd></div>
            {model.issuedOn ? <div><dt><Bi en="Date" id="Tanggal" /></dt><dd>{model.issuedOn}</dd></div> : null}
            {model.holder?.name ? <div><dt><Bi en="Awarded to" id="Diberikan kepada" /></dt><dd>{model.holder.name}{model.holder.title ? <><br /><span className="vf-small">{model.holder.title}</span></> : null}</dd></div> : null}
            {model.holder?.validUntil ? <div><dt><Bi en="Valid until" id="Berlaku sampai" /></dt><dd>{model.holder.validUntil}</dd></div> : null}
          </dl>
          <CopyButtons url={url} reference={model.reference} />
        </section>

        <div className="vf-findings">
          <section className="vf-surface" aria-labelledby="vf-h-record">
            <h2 id="vf-h-record">1 · <Bi en="Record" id="Catatan" /></h2>
            <p className="vf-fact"><span aria-hidden="true">✓</span><span className="vf-fact-text"><Bi en="Verification record found" id="Catatan verifikasi ditemukan" /></span></p>
            <p>{model.policy.confirms.en}<br /><span className="vf-id">{model.policy.confirms.id}</span></p>
            <p className="vf-small">{model.policy.doesNotConfirm.en}<br /><span className="vf-id">{model.policy.doesNotConfirm.id}</span></p>
          </section>

          <section className="vf-surface" aria-labelledby="vf-h-issuance">
            <h2 id="vf-h-issuance">2 · <Bi en="Issuance" id="Penerbitan" /></h2>
            <p className={`vf-fact vf-${issuance.tone}`}><span aria-hidden="true">{issuance.tone === 'ok' ? '✓' : issuance.tone === 'bad' ? '✕' : '–'}</span><span className="vf-fact-text"><Bi en={issuance.en} id={issuance.id} /></span></p>
            <p className="vf-small">{issuance.detail.en}<br /><span className="vf-id">{issuance.detail.id}</span></p>
            {model.artifacts.map((a) => a.keyId ? <p key={a.version} className="vf-small vf-mono">v{a.version} · {a.role} · key {a.keyId} · {when(a.issuedAt)}</p> : null)}
            {model.chain ? <p className="vf-small"><span aria-hidden="true">{model.chain.ok ? '✓' : '✕'}</span> {model.chain.ok ? `Evidence history intact (${model.chain.events} events)` : 'Evidence history failed its check'} <span className="vf-id">| {model.chain.ok ? `Riwayat bukti utuh (${model.chain.events} peristiwa)` : 'Riwayat bukti gagal diperiksa'}</span></p> : null}
          </section>

          <section className="vf-surface" aria-labelledby="vf-h-signing">
            <h2 id="vf-h-signing">3 · <Bi en="Signing" id="Penandatanganan" /></h2>
            {model.signing === 'not_applicable' ? <p className="vf-fact vf-neutral"><span aria-hidden="true">–</span><span className="vf-fact-text"><Bi en="Not signed by a person: this kind of document is issued and verified" id="Tidak ditandatangani perorangan: jenis dokumen ini diterbitkan dan diverifikasi" /></span></p> : null}
            {model.signing === 'none_yet' ? <p className="vf-fact vf-neutral"><span aria-hidden="true">–</span><span className="vf-fact-text"><Bi en="No personal signature recorded" id="Tidak ada tanda tangan pribadi yang tercatat" /></span></p> : null}
            {model.signing === 'incomplete' ? <p className="vf-fact vf-warn"><span aria-hidden="true">!</span><span className="vf-fact-text"><Bi en="Signing evidence incomplete: a signing is still open" id="Bukti penandatanganan belum lengkap: penandatanganan masih terbuka" /></span></p> : null}
            {model.signings.length ? <p className="vf-fact vf-ok"><span aria-hidden="true">✓</span><span className="vf-fact-text"><Bi en="Signing evidence available" id="Bukti penandatanganan tersedia" /></span></p> : null}
            {model.signings.map((s) => (
              <p key={s.ref} className="vf-sign">
                <strong>{s.signerName}</strong>, {s.signerPosition}<br />
                <span className="vf-small">{PURPOSE_LABELS.en[s.purpose as keyof typeof PURPOSE_LABELS.en] ?? s.purpose} · {when(s.signedAt)} · version {s.version} · <span className="vf-mono">{s.ref}</span><br />
                {METHOD_LABEL.vora_electronic.en}. Signer authenticated with a passkey after explicit consent to this exact file. <span className="vf-id">{METHOD_LABEL.vora_electronic.id}.</span></span>
              </p>
            ))}
            {model.parties.length ? (
              <div className="vf-parties">
                <p className="vf-small"><strong>Parties <span className="vf-id">| Para pihak</span></strong>: {model.executed ? 'every required party has signed' : 'not every required party has signed'}</p>
                <ul>{model.parties.map((p) => <li key={p.role}><span aria-hidden="true">{p.method ? '✓' : '○'}</span> {p.name}{p.required ? '' : ' (optional)'} - {p.method ? METHOD_LABEL[p.method]?.en ?? p.method : 'not yet signed'}</li>)}</ul>
              </div>
            ) : null}
          </section>

          {live && model.live.length ? (
            <section className="vf-surface" aria-labelledby="vf-h-status">
              <h2 id="vf-h-status">4 · <Bi en="Current status" id="Status terkini" /></h2>
              {model.live.map((l) => <p key={l.label.en}><span className="vf-small">{l.label.en} <span className="vf-id">| {l.label.id}</span></span><br /><strong>{l.value}</strong></p>)}
              <p className="vf-small">Read live from VORA's records now. It is never printed into the issued file. <span className="vf-id">Dibaca langsung dari catatan VORA saat ini; tidak pernah dicetak ke dalam berkas yang diterbitkan.</span></p>
            </section>
          ) : null}

          <section className="vf-surface vf-wide" aria-labelledby="vf-h-file">
            <h2 id="vf-h-file">{live && model.live.length ? 5 : 4} · <Bi en="File integrity" id="Keutuhan berkas" /></h2>
            {model.artifacts.length ? (
              <div className="vf-hashes">
                {model.artifacts.map((a) => <p key={a.version} className="vf-small"><strong>SHA-256 · version {a.version} ({a.role === 'signed' ? 'signed | ditandatangani' : 'issued | diterbitkan'})</strong><br /><span className="vf-mono vf-hash">{a.sha256}</span></p>)}
                {model.source ? <p className="vf-small"><strong>SHA-256 · original third-party file | berkas asli pihak lain</strong><br /><span className="vf-mono vf-hash">{model.source.originalSha256}</span></p> : null}
                {model.source ? <p className="vf-small"><strong>{model.source.title}</strong> · issued by {model.source.issuer}{model.source.reference ? ` · original no. ${model.source.reference}` : ''}. VORA does not establish the authenticity of the external issuer. <span className="vf-id">VORA tidak membuktikan keaslian penerbit eksternal.</span></p> : null}
              </div>
            ) : <p className="vf-small">No file is recorded for this document, so a file cannot be checked against it. <span className="vf-id">Tidak ada berkas yang tercatat untuk dokumen ini, sehingga berkas tidak dapat dicocokkan.</span></p>}
            <FileCheck recorded={recorded} />
          </section>
        </div>

        <footer className="vf-foot">
          <p><strong>{OFFICIAL_DOMAIN}</strong> · Viewed on {OFFICIAL_DOMAIN} · {when(viewedAt.toISOString())} · Ref {token.slice(0, 8).toUpperCase()}</p>
          <p className="vf-notice">Document authenticity and current status should be checked through VORA&apos;s official verification page. A screenshot alone is not independent verification evidence.<br /><span className="vf-id">Keaslian dokumen dan status terkininya harus diperiksa melalui halaman verifikasi resmi VORA. Tangkapan layar bukan bukti verifikasi yang berdiri sendiri.</span></p>
          <p className="vf-small">The repeated VORA mark in the background is a visual deterrent only; it does not prove authenticity. Customer and financial details are not shown here. <span className="vf-id">Tanda VORA berulang di latar hanyalah penangkal visual, bukan bukti keaslian. Data pelanggan dan keuangan tidak ditampilkan di sini.</span></p>
          <p className="vf-small"><a className="vf-link" href={`/verify/${token}/evidence`}>Evidence summary (JSON) <span className="vf-id">| Ringkasan bukti</span></a></p>
        </footer>
      </div>
      {/* One faint layer in front of everything, anchored to the page like the one behind it, so that the two share a phase and neither is cut at a card's edge. */}
      <Watermark layer="front" id="f" />
    </main>
  )
}
