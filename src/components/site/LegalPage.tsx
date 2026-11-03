import { ObjectArt } from '@/components/atelier/ObjectArt'
import { makeT, type Locale } from '@/content'
import { withContents } from '@/lib/contents'
import { cleanHtml } from '@/server/sanitize'
import { getSettings } from '@/server/site'
import { LEGAL_DOCUMENTS } from '@/content/legal'

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
  const { html, toc } = withContents(cleanHtml(raw))
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
