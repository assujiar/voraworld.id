/**
 * A document link that does not match anything: a delivery proof, a quotation approval or any other private document address. The page is answered with 200 (it is a result, like the
 * verification page's own "no record"), says plainly that nothing was found, and has none of the look of a real document. It is never indexed (the whole group is `noindex`).
 */
export default function DocsNotFound() {
  return (
    <main className="vf-page vf-plain">
      <div className="vf-inner">
        <header className="vf-head"><a href="/en" aria-label="VORA"><img src="/static/assets/vora-primary.svg" alt="VORA" width={150} /></a></header>
        <section className="vf-banner vf-bad" aria-labelledby="doc-nf">
          <span className="vf-mark" aria-hidden="true">✕</span>
          <div>
            <h1 id="doc-nf">DOCUMENT LINK NOT FOUND <span className="vf-id">| TAUTAN DOKUMEN TIDAK DITEMUKAN</span></h1>
            <p>This link does not match any document or request at VORA. It may have been mistyped, copied incompletely, replaced by a newer one, or it may no longer be active. Nothing on this page is a VORA document.<br /><span className="vf-id">Tautan ini tidak cocok dengan dokumen atau permintaan mana pun di VORA. Mungkin salah ketik, tersalin tidak lengkap, sudah diganti yang baru, atau tidak lagi aktif. Tidak ada yang di halaman ini merupakan dokumen VORA.</span></p>
            <p className="vf-small">If you were sent this link, ask the person who sent it, or write to info@voraworld.id. <span className="vf-id">Jika tautan ini dikirim kepada Anda, tanyakan kepada pengirimnya, atau tulis ke info@voraworld.id.</span></p>
          </div>
        </section>
      </div>
    </main>
  )
}
