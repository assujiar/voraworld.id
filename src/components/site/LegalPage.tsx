import { makeT, type Locale } from '@/content'
import { withContents } from '@/lib/contents'
import { cleanHtml } from '@/server/sanitize'
import { getSettings } from '@/server/site'

/** The legal text for one language: Indonesian has its own reviewed text (`privacy_id` / `terms_id`); English keeps `privacy` / `terms`. */
export async function legalText(locale: Locale, kind: 'privacy' | 'terms'): Promise<{ html: string; fallback: boolean }> {
  const s = await getSettings()
  if (locale === 'en') return { html: (s[kind] ?? '').trim(), fallback: false }
  const own = (s[`${kind}_id`] ?? '').trim()
  return own ? { html: own, fallback: false } : { html: (s[kind] ?? '').trim(), fallback: true }
}

export async function LegalPage({ locale, kind }: { locale: Locale; kind: 'privacy' | 'terms' }) {
  const t = makeT(locale)
  const { html: raw, fallback } = await legalText(locale, kind)
  const { html, toc } = withContents(cleanHtml(raw))
  const title = kind === 'privacy' ? t('Privacy Notice', 'Pemberitahuan Privasi') : t('Terms of Use', 'Ketentuan Penggunaan')
  return (
    <>
      <header className="v-article" style={{ paddingTop: 'clamp(40px,6vw,88px)' }}>
        <h1 className="v-h2 v-h2--page">{title}</h1>
        {raw ? null : <p className="v-note">{t('This document is being finalised. Contact VORA for the current text.', 'Dokumen ini sedang difinalisasi. Hubungi VORA untuk teks terbaru.')}</p>}
        {fallback && raw ? (
          <p className="v-note" role="note">Versi bahasa Indonesia dari dokumen ini sedang ditinjau. Sementara itu, teks yang berlaku di bawah ini ditampilkan dalam bahasa Inggris. <a className="v-link" href={`/en/${kind}`} hrefLang="en">Open the English version</a>.</p>
        ) : null}
      </header>
      <section className="v-article v-legal">
        {toc.length > 2 ? (
          <nav className="v-toc" aria-label={t('On this page', 'Di halaman ini')}>
            <strong>{t('On this page', 'Di halaman ini')}</strong>
            <ol>{toc.map((i) => <li key={i.id}><a href={`#${i.id}`}>{i.text}</a></li>)}</ol>
          </nav>
        ) : null}
        <div className="article-body" lang={fallback ? 'en' : locale} dangerouslySetInnerHTML={{ __html: html }} />
      </section>
    </>
  )
}
