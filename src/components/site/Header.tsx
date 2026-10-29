import { makeT, serviceGroups, serviceModes, siteText, type Locale } from '@/content'
import type { NavLink } from '@/server/site'
import { LangSwitch, MenuBehavior } from './ClientBits'

export function Header({ locale, nav }: { locale: Locale; nav: NavLink[] }) {
  const t = makeT(locale)
  const text = siteText[locale]
  const groups = Object.entries(serviceGroups)
  return (
    <header className="site-header">
      <div className="wrap header-inner">
        <a className="brand" aria-label={t('VORA home', 'Beranda VORA')} href={`/${locale}`}>
          <img src="/static/assets/vora-primary.svg" alt="VORA Freight & Logistics" width={155} height={45} />
        </a>
        <nav className="topnav" aria-label={t('Main navigation', 'Navigasi utama')}>
          {nav.map((item) =>
            item.href === '/services' ? (
              <details className="nav-services" key={item.href}>
                <summary>{item.label} <span aria-hidden="true">⌄</span></summary>
                <div className="mega-panel">
                  <div className="mega-heading">
                    <small>VORA / {t('SERVICE PORTFOLIO', 'PORTOFOLIO LAYANAN')}</small>
                    <a href={`/${locale}/services`}>{t('View all services', 'Seluruh layanan')} ↗</a>
                  </div>
                  <div className="mega-grid">
                    {groups.map(([slug, group]) => (
                      <div className="mega-group" key={slug}>
                        <a className="mega-primary" href={`/${locale}/services/${slug}`}><span>{group.index}</span> {group[locale].name}</a>
                        {group.modes.map((mode) => (
                          <a className="mega-secondary" key={mode} href={`/${locale}/services/${slug}/${mode}`}>{serviceModes[slug][mode][locale][0]}</a>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </details>
            ) : (
              <a key={item.href} href={`/${locale}${item.href}`}>{item.label}</a>
            ),
          )}
        </nav>
        <div className="rightnav">
          <LangSwitch locale={locale} />
          <a className="button" href={`/${locale}/request-quote`}>{text.rfq} <span aria-hidden="true">↗</span></a>
          <details className="mobile-nav">
            <summary aria-label={t('Open mobile navigation', 'Buka navigasi seluler')}>☰</summary>
            <nav className="mobile-menu" aria-label={t('Mobile navigation', 'Navigasi seluler')}>
              <a href={`/${locale}`}>{t('Home', 'Beranda')}</a>
              {nav.map((item) =>
                item.href === '/services' ? (
                  <span key={item.href} style={{ display: 'contents' }}>
                    <a className="mobile-primary" href={`/${locale}/services`}>{item.label}</a>
                    {groups.map(([slug, group]) => (
                      <details className="mobile-service-branch" key={slug}>
                        <summary>{group[locale].name}</summary>
                        <div className="mobile-service-links">
                          <a href={`/${locale}/services/${slug}`}>{t('Overview', 'Ringkasan')} ↗</a>
                          {group.modes.map((child) => (
                            <a key={child} href={`/${locale}/services/${slug}/${child}`}>{serviceModes[slug][child][locale][0]}</a>
                          ))}
                        </div>
                      </details>
                    ))}
                  </span>
                ) : (
                  <a key={item.href} href={`/${locale}${item.href}`}>{item.label}</a>
                ),
              )}
              <a href={`/${locale}/request-quote`}>{text.rfq}</a>
            </nav>
          </details>
        </div>
      </div>
      <MenuBehavior />
    </header>
  )
}
