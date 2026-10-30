import { makeT, type Locale } from '@/content'
import { cleanHtml } from '@/server/sanitize'
import { getSettings } from '@/server/site'

export async function LegalPage({ locale, kind }: { locale: Locale; kind: 'privacy' | 'terms' }) {
  const t = makeT(locale)
  const html = cleanHtml((await getSettings())[kind] ?? '')
  return (
    <>
      <header className="v-article" style={{ paddingTop: 'clamp(40px,6vw,88px)' }}>
        <h1 className="v-h2" style={{ fontSize: 'clamp(2.1rem,4.8vw,3.6rem)' }}>{kind === 'privacy' ? t('Privacy Notice', 'Pemberitahuan Privasi') : t('Terms of Use', 'Ketentuan Penggunaan')}</h1>
      </header>
      <section className="v-article">
        {html ? null : <p className="v-note">{t('This document is being finalised. Contact VORA for the current policy.', 'Dokumen ini sedang difinalisasi. Hubungi VORA untuk kebijakan terbaru.')}</p>}
        <div className="article-body" dangerouslySetInnerHTML={{ __html: html }} />
      </section>
    </>
  )
}
