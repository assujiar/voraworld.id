import { makeT, type Locale } from '@/content'
import { cleanHtml } from '@/server/sanitize'
import { getSettings } from '@/server/site'

export async function LegalPage({ locale, kind }: { locale: Locale; kind: 'privacy' | 'terms' }) {
  const t = makeT(locale)
  const html = cleanHtml((await getSettings())[kind] ?? '')
  return (
    <section className="page-intro"><div className="wrap">
      <span className="eyebrow">{t('Legal information', 'Informasi hukum')}</span>
      <h1>{kind === 'privacy' ? t('Privacy Notice', 'Pemberitahuan Privasi') : t('Terms of Use', 'Ketentuan Penggunaan')}</h1>
      {html ? null : <div className="note">{t('This document is being finalised. Contact VORA for the current policy.', 'Dokumen ini sedang difinalisasi. Hubungi VORA untuk kebijakan terbaru.')}</div>}
      <div className="article-body" dangerouslySetInnerHTML={{ __html: html }} />
    </div></section>
  )
}
