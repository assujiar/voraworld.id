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
      <section className="v-section v-section--tight">
        <div className="v-wrap v-faq">
          <div>
            <h1 className="v-h2" style={{ fontSize: 'clamp(2.2rem,4.8vw,4rem)' }}>{siteText[locale].faq_title}</h1>
            <p className="v-muted" style={{ marginTop: 18 }}>{t('Ask for confirmation when your shipment has regulatory or technical requirements.', 'Mintalah konfirmasi bila pengiriman Anda memiliki persyaratan regulasi atau teknis.')}</p>
          </div>
          <div className="v-faq__list">
            {faqs.length ? faqs.map((f, i) => <details key={i}><summary>{f.question as string}</summary><p>{f.answer as string}</p></details>)
              : <p className="v-note">{t('No answers are published yet.', 'Belum ada jawaban yang dipublikasikan.')} <a className="v-link" href={`/${locale}/contact`}>{t('Write to us', 'Tulis kepada kami')}</a> {t('with your question.', 'dengan pertanyaan Anda.')}</p>}
          </div>
        </div>
      </section>
      <CustomSections locale={locale} sections={custom?.sections} />
      <CtaBand locale={locale} />
    </>
  )
}
