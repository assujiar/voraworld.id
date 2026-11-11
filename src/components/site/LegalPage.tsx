import { ObjectArt } from '@/components/atelier/ObjectArt'
import { makeT, type Locale } from '@/content'
import { withContents } from '@/lib/contents'
import { cleanHtml } from '@/server/sanitize'
import { getSettings } from '@/server/site'
import { LEGAL_DOCUMENTS } from '@/content/legal'


/** This notice is appended even when the Privacy Notice body is customised in the CMS. */
const AGENT_PRIVACY_NOTICE: Record<Locale, string> = {
  en: `<h2>AI Assistant and Chat Data</h2>
<p>If you choose to use VORA's AI assistant, your chat messages are sent to VORA's selected AI provider (Google Gemini or OpenAI) to generate responses. The provider and model can change. Processing and retention follow the selected provider's terms and project settings, which may differ between free and paid plans. Please avoid entering confidential documents, financial credentials, government identifiers or other sensitive information in the AI chat. The assistant cannot verify live shipment rates, customs permissions or bookings.</p>
<p>Before opening a new conversation, VORA asks for your full name, company, phone number and email address. We use these details to maintain a business contact record, check for duplicate contact details in existing leads/customers and respond to inquiries. Exact matches may link to an existing contact without creating a new master contact; uncertain matches are held for internal review rather than merged automatically. Contact records and CRM inquiries are retained separately from chat history according to the applicable business contact retention policy. Registration contact details are not included in the AI prompt.</p>
<p>VORA keeps a private copy of the conversation to allow follow-up questions. An HttpOnly session cookie associates your browser with the chat. Sessions expire after seven days and expired records are cleared through routine cleanup; you may also select “Delete chat &amp; start over” to delete your conversation immediately. Rate-limit counters contain hashed network information and are cleared through routine cleanup.</p>
<p>If you explicitly choose “Send to the team”, the name, contact information and inquiry summary you review and submit are saved as a separate VORA CRM inquiry and handled under the business inquiry retention terms above.</p>`,
  id: `<h2>Asisten AI dan Data Percakapan</h2>
<p>Jika Anda menggunakan asisten AI VORA, pesan chat dikirim ke penyedia AI yang dipilih VORA (Google Gemini atau OpenAI) untuk menghasilkan jawaban. Penyedia dan model dapat berubah. Pengolahan dan retensi data mengikuti ketentuan penyedia serta pengaturan proyek yang digunakan, termasuk kemungkinan perbedaan kebijakan antara paket gratis dan berbayar. Hindari mengirim dokumen rahasia, informasi keuangan sensitif, identitas resmi, atau data pribadi sensitif melalui chat AI. Asisten tidak dapat memverifikasi rate pengiriman, perizinan kepabeanan, atau booking secara real-time.</p>
<p>Sebelum memulai percakapan baru, VORA meminta nama lengkap, nama perusahaan, nomor HP dan alamat email. Data digunakan untuk pencatatan kontak bisnis, pengecekan duplikasi dengan data leads/customers yang sudah ada, serta tindak lanjut inquiry. Data yang cocok tepat dapat ditautkan ke kontak existing tanpa membuat master kontak baru; kecocokan yang meragukan ditandai untuk review internal, bukan otomatis digabung. Data kontak dan inquiry CRM memiliki penyimpanan terpisah dari histori chat sesuai kebijakan retensi data kontak bisnis. Data kontak registrasi tidak dimasukkan ke prompt AI.</p>
<p>VORA menyimpan salinan percakapan secara privat agar pertanyaan lanjutan tetap memiliki konteks. Cookie sesi HttpOnly menghubungkan browser dengan riwayat chat. Sesi berakhir setelah tujuh hari dan data kedaluwarsa dihapus melalui proses pembersihan rutin. Anda juga dapat memilih “Hapus chat &amp; mulai baru” untuk langsung menghapus percakapan. Data pembatasan akses menggunakan informasi jaringan yang telah di-hash dan dibersihkan secara berkala.</p>
<p>Jika Anda memilih “Teruskan ke tim”, nama, kontak, dan ringkasan inquiry yang telah Anda periksa dan kirimkan akan disimpan sebagai inquiry terpisah dalam CRM VORA dengan kebijakan penyimpanan data inquiry sebagaimana dijelaskan di atas.</p>`,
}

/** A locale's CMS text wins; the owner-supplied bilingual policy prevents empty pages on a clean install. */
export async function legalText(locale: Locale, kind: 'privacy' | 'terms'): Promise<{ html: string; fallback: boolean }> {
  const s = await getSettings()
  const own = cleanHtml(s[locale === 'en' ? kind : `${kind}_id`] ?? '').trim()
  const meaningful = own.replace(/<[^>]*>/g, '').replace(/&(?:nbsp|#160|#xA0);/gi, ' ').trim()
  return { html: meaningful ? own : LEGAL_DOCUMENTS[kind][locale], fallback: false }
}

export async function LegalPage({ locale, kind }: { locale: Locale; kind: 'privacy' | 'terms' }) {
  const t = makeT(locale)
  const { html: raw } = await legalText(locale, kind)
  const { html, toc } = withContents(cleanHtml(raw + (kind === 'privacy' ? AGENT_PRIVACY_NOTICE[locale] : '')))
  const title = kind === 'privacy' ? t('Privacy Notice', 'Pemberitahuan Privasi') : t('Terms of Use', 'Ketentuan Penggunaan')
  return (
    <>
      <header className="v-article" style={{ paddingTop: 'clamp(40px,6vw,88px)' }}>
        <div className="a-legal-heading"><h1 className="v-h2 v-h2--page">{title}</h1><ObjectArt asset={kind === 'privacy' ? 'data-cloud' : 'scope-shield'} sizes="(max-width: 600px) 88px, 140px" /></div>

      </header>
      <section className="v-article v-legal">
        {toc.length > 2 ? (
          <nav className="v-toc" aria-label={t('On this page', 'Di halaman ini')}>
            <strong>{t('On this page', 'Di halaman ini')}</strong>
            <ol>{toc.map((i) => <li key={i.id}><a href={`#${i.id}`}>{i.text}</a></li>)}</ol>
          </nav>
        ) : null}
        <div className="article-body" lang={locale} dangerouslySetInnerHTML={{ __html: html }} />
      </section>
    </>
  )
}
