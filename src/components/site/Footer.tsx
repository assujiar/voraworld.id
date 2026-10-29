import { makeT, navLabels, serviceGroups, siteText, type Locale } from '@/content'

export function Footer({ locale, settings }: { locale: Locale; settings: Record<string, string> }) {
  const t = makeT(locale)
  const labels = navLabels[locale]
  const text = siteText[locale]
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer-grid">
          <div className="footer-identity">
            <a className="brand" href={`/${locale}`}><img src="/static/assets/vora-reverse.svg" alt="VORA" width={175} /></a>
            <p className="footer-tagline">{text.home_title}</p>
            <p>{settings.company_description ?? ''}</p>
          </div>
          <div>
            <small>{t('Company', 'Perusahaan')}</small>
            <a href={`/${locale}/about`}>{labels['/about']}</a>
            <a href={`/${locale}/solutions`}>{labels['/solutions']}</a>
            <a href={`/${locale}/network`}>{labels['/network']}</a>
            <a href={`/${locale}/insights`}>{labels['/insights']}</a>
            <a href={`/${locale}/faq`}>FAQ</a>
          </div>
          <div className="footer-services">
            <small>{t('Our services', 'Layanan kami')}</small>
            {Object.entries(serviceGroups).map(([slug, group]) => (
              <a key={slug} href={`/${locale}/services/${slug}`}>{group[locale].name}</a>
            ))}
          </div>
          <div>
            <small>{t('Get in touch', 'Hubungi kami')}</small>
            <a href={`/${locale}/contact`}>{labels['/contact']}</a>
            <a href={`/${locale}/request-quote`}>{text.rfq}</a>
            {settings.email ? <a href={`mailto:${settings.email}`}>{settings.email}</a> : null}
            {settings.address ? <p>{settings.address}</p> : null}
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} VORA · {settings.legal_name || 'PT Satu Arah International'}</span>
          <span>
            <a href={`/${locale}/privacy`}>{t('Privacy', 'Privasi')}</a> · <a href={`/${locale}/terms`}>{t('Terms', 'Ketentuan')}</a> · Freight &amp; Logistics
          </span>
        </div>
      </div>
    </footer>
  )
}
