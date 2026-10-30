import { CtaBand } from '@/components/site/CtaBand'
import { CustomSections } from '@/components/site/CustomSections'
import { faqEntries } from '@/content/faq'
import { jsonLd } from '@/lib/metadata'
import { makeT, seoDescription, siteText } from '@/content'
import { many } from '@/server/data'
import { localeOf, type LocaleParams } from '@/lib/page'
import { pageMetadata } from '@/lib/metadata'
import { getPublishedPage } from '@/server/site'

export async function generateMetadata({ params }: LocaleParams) {
  const locale = await localeOf(params)
  return pageMetadata({ locale, path: '/faq', title: `${siteText[locale].faq_title} | VORA`, description: seoDescription[locale] })
}

export default async function Faq({ params }: LocaleParams) {
  const locale = await localeOf(params)
  const t = makeT(locale)
  const [faqs, custom] = await Promise.all([many('faqs', (q) => q.eq('visible', true).order('position').order('id'), 'question,answer'), getPublishedPage('faq', locale)])
  // Questions entered in the admin portal win; until there are any, the reviewed answers below are shown.
  const items = faqs.length ? faqs.map((f) => ({ q: f.question as string, a: f.answer as string })) : faqEntries.map((f) => ({ q: f.q[locale], a: f.a[locale] }))
  const ld = { '@context': 'https://schema.org', '@type': 'FAQPage', inLanguage: locale, mainEntity: items.map((i) => ({ '@type': 'Question', name: i.q, acceptedAnswer: { '@type': 'Answer', text: i.a } })) }
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(ld) }} />
      <section className="v-section v-section--tight">
        <div className="v-wrap v-faq">
          <div>
            <h1 className="v-h2" style={{ fontSize: 'clamp(2.2rem,4.8vw,4rem)' }}>{siteText[locale].faq_title}</h1>
            <p className="v-muted" style={{ marginTop: 18 }}>{t('Ask for confirmation when your shipment has regulatory or technical requirements.', 'Mintalah konfirmasi bila pengiriman Anda memiliki persyaratan regulasi atau teknis.')}</p>
          </div>
          <div className="v-faq__list">
            {items.map((f, i) => <details key={i}><summary>{f.q}</summary><p>{f.a}</p></details>)}
            <p className="v-note">{t('Your question is not here?', 'Pertanyaan Anda belum ada?')} <a className="v-link" href={`/${locale}/contact`}>{t('Write to us', 'Tulis kepada kami')}</a>.</p>
          </div>
        </div>
      </section>
      <CustomSections locale={locale} sections={custom?.sections} />
      <CtaBand locale={locale} />
    </>
  )
}
