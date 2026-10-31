import { makeT, navLabels, serviceGroups, siteText, type Locale } from '@/content'
import { FOOTER_DESCRIPTION } from '@/content/footer'

export function Footer({ locale, settings }: { locale: Locale; settings: Record<string, string> }) {
  const t = makeT(locale)
  const labels = navLabels[locale]
  const text = siteText[locale]
  return (
    <footer className="v-footer">
      <div className="v-wrap">
        <div className="v-footer__grid">
          <div>
            <a href={`/${locale}`}><img src="/static/assets/vora-reverse.svg" alt="VORA" width={150} height={44} /></a>
            <p className="v-footer__tag">{text.home_title}</p>
            <p className="v-footer__about">{settings[`footer_description_${locale}`]?.trim() || FOOTER_DESCRIPTION[locale]}</p>
          </div>
          <div>
            <h4>{t('Company', 'Perusahaan')}</h4>
            <a href={`/${locale}/about`}>{labels['/about']}</a>
            <a href={`/${locale}/solutions`}>{labels['/solutions']}</a>
            <a href={`/${locale}/network`}>{labels['/network']}</a>
            <a href={`/${locale}/insights`}>{labels['/insights']}</a>
            <a href={`/${locale}/faq`}>FAQ</a>
          </div>
          <div>
            <h4>{t('Services', 'Layanan')}</h4>
            {Object.entries(serviceGroups).map(([slug, group]) => <a key={slug} href={`/${locale}/services/${slug}`}>{group[locale].name}</a>)}
          </div>
          <div>
            <h4>{t('Contact', 'Kontak')}</h4>
            <a href={`/${locale}/contact`}>{labels['/contact']}</a>
            <a href={`/${locale}/request-quote`}>{text.rfq}</a>
            {settings.email ? <a href={`mailto:${settings.email}`}>{settings.email}</a> : null}
            {settings.address ? <p style={{ marginTop: 12 }}>{settings.address}</p> : null}
          </div>
        </div>
        <div className="v-footer__base">
          <span>© 2023 VORA · {settings.legal_name || 'PT Satu Arah International'}</span>
          <span><a href={`/${locale}/privacy`}>{t('Privacy', 'Privasi')}</a> · <a href={`/${locale}/terms`}>{t('Terms', 'Ketentuan')}</a></span>
        </div>
      </div>
    </footer>
  )
}
