import { makeT, type Locale } from '@/content'
import { cleanHtml } from '@/server/sanitize'
import { getSettings } from '@/server/site'

/** The legal text for one language: Indonesian has its own reviewed text (`privacy_id` / `terms_id`); English keeps `privacy` / `terms`. */
export async function legalText(locale: Locale, kind: 'privacy' | 'terms'): Promise<{ html: string; fallback: boolean }> {
  const s = await getSettings()
  if (locale === 'en') return { html: (s[kind] ?? '').trim(), fallback: false }
  const own = (s[`${kind}_id`] ?? '').trim()
  return own ? { html: own, fallback: false } : { html: (s[kind] ?? '').trim(), fallback: true }
}

/** Contents list built from the headings of the (already sanitised) text; the ids are made here, from the heading text, never taken from the stored HTML. */
export function withContents(html: string): { html: string; toc: Array<{ id: string; text: string }> } {
  const toc: Array<{ id: string; text: string }> = []
  const used = new Set<string>()
  const out = html.replace(/<h2>([\s\S]*?)<\/h2>/g, (_m, inner: string) => {
    const text = inner.replace(/<[^>]+>/g, '').trim()
    let id = text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'section'
    while (used.has(id)) id += '-x'
    used.add(id); toc.push({ id, text })
    return `<h2 id="${id}">${inner}</h2>`
  })
  return { html: out, toc }
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
