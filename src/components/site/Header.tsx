import { makeT, serviceGroups, serviceModes, siteText, type Locale } from '@/content'
import type { NavLink } from '@/server/site'
import { HeaderNav, type NavGroup } from './HeaderNav'
import { BrandMotion } from '@/components/atelier/BrandMotion'
import { PublicSearch } from './PublicSearch'
import { LangSwitch } from './ClientBits'

export function Header({ locale, nav }: { locale: Locale; nav: NavLink[] }) {
  const t = makeT(locale)
  const groups: NavGroup[] = Object.entries(serviceGroups).map(([slug, g]) => ({ slug, name: g[locale].name, modes: g.modes.map((m) => ({ slug: m, name: serviceModes[slug][m][locale][0] })) }))
  const modes = Object.entries(serviceGroups).flatMap(([slug, g]) => [slug, ...g.modes.map((m) => `${slug}/${m}`)])
  return (
    <header className="v-header">
      <div className="v-wrap v-header__in">
        <a className="v-brand" aria-label={t('VORA home', 'Beranda VORA')} href={`/${locale}`}>
          <BrandMotion study="editorial" label="VORA Freight & Logistics" />
        </a>
        <HeaderNav locale={locale} items={nav.map((n) => ({ href: n.href, label: n.label }))} groups={groups} rfq={siteText[locale].rfq} modes={modes}
          words={{ allServices: t('All services', 'Semua layanan'), home: t('Home', 'Beranda'), open: t('Open the menu', 'Buka menu'), mobile: t('Mobile navigation', 'Navigasi seluler'), main: t('Main navigation', 'Navigasi utama') }} />
        <PublicSearch locale={locale} />
        <div className="v-header__end">
          <LangSwitch locale={locale} modes={modes} />
          <a className="v-btn" href={`/${locale}/request-quote`}>{siteText[locale].rfq}</a>
        </div>
      </div>
    </header>
  )
}
