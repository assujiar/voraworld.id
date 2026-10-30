import { CtaBand } from '@/components/site/CtaBand'
import { CustomSections } from '@/components/site/CustomSections'
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
  return (
    <>
      <section className="page-intro page-intro--faq"><div className="wrap">
        <img className="page-art" src="/static/assets/vora-visual-60.webp" width={580} height={580} alt={t('Document review and clearance illustration', 'Ilustrasi peninjauan dokumen dan clearance')} />
        <span className="eyebrow">{t('Questions', 'Pertanyaan')}</span><h1>{siteText[locale].faq_title}</h1>
        <p>{t('Ask for confirmation when your shipment has regulatory or technical requirements.', 'Mintalah konfirmasi bila pengiriman Anda memiliki persyaratan regulasi atau teknis.')}</p>
      </div></section>
      <section className="site-section section-white"><div className="wrap compact faq">
        {faqs.length ? faqs.map((f, i) => <details key={i}><summary>{f.question as string}</summary><p>{f.answer as string}</p></details>)
          : <p>{t('No answers are published yet.', 'Belum ada jawaban yang dipublikasikan.')} <a href={`/${locale}/contact`}>{t('Contact us', 'Hubungi kami')}</a> {t('for specific questions.', 'untuk pertanyaan spesifik.')}</p>}
      </div></section>
      <CustomSections locale={locale} sections={custom?.sections} />
      <CtaBand locale={locale} />
    </>
  )
}
