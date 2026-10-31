/** An unknown or malformed verification address: a plain "not found", with none of the look of a verified record (no watermark, no document details). */
export default function VerifyNotFound() {
  return (
    <main className="vf-page vf-plain">
      <div className="vf-inner">
        <header className="vf-head"><a href="/en" aria-label="VORA"><img src="/static/assets/vora-primary.svg" alt="VORA" width={150} /></a></header>
        <section className="vf-banner vf-bad" aria-labelledby="vf-nf">
          <span className="vf-mark" aria-hidden="true">✕</span>
          <div>
            <h1 id="vf-nf">NO VERIFICATION RECORD FOUND <span className="vf-id">/ CATATAN VERIFIKASI TIDAK DITEMUKAN</span></h1>
            <p>This address does not match any document issued by VORA. It may have been mistyped, copied incompletely or altered. Do not rely on a document that points here.<br /><span className="vf-id">Alamat ini tidak cocok dengan dokumen mana pun yang diterbitkan VORA. Mungkin salah ketik, tersalin tidak lengkap, atau diubah. Jangan mengandalkan dokumen yang mengarah ke sini.</span></p>
            <p className="vf-small">Official verification pages are only at voraworld.id/verify/… <span className="vf-id">Halaman verifikasi resmi hanya di voraworld.id/verify/…</span></p>
          </div>
        </section>
      </div>
    </main>
  )
}
