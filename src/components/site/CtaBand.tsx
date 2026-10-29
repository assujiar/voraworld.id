import { makeT, siteText, type Locale } from '@/content'

export function CtaBand({ locale }: { locale: Locale }) {
  const t = makeT(locale)
  return (
    <section className="site-section section-paper">
      <div className="wrap split">
        <div>
          <span className="eyebrow">{t('The next movement', 'Pengiriman berikutnya')}</span>
          <h2>{t('Where are you going next?', 'Ke mana tujuan Anda berikutnya?')}</h2>
        </div>
        <div>
          <p>{t('Discuss the cargo, origin, destination and scope with our team before making a logistics commitment.', 'Diskusikan kargo, asal, tujuan, dan cakupan dengan tim kami sebelum menetapkan komitmen logistik.')}</p>
          <a className="button" href={`/${locale}/request-quote`}>{siteText[locale].rfq} ↗</a>
        </div>
      </div>
    </section>
  )
}
