'use client'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

export interface NavGroup { slug: string; name: string; modes: Array<{ slug: string; name: string }> }
interface Props {
  locale: 'en' | 'id'
  items: Array<{ href: string; label: string }>
  groups: NavGroup[]
  rfq: string
  words: { allServices: string; home: string; open: string; mobile: string; main: string }
}

/** The navigation: current page marked, the services panel, and the phone menu. Escape and a click elsewhere close what is open. */
export function HeaderNav({ locale, items, groups, rfq, words }: Props) {
  const path = usePathname() || `/${locale}`
  const here = (href: string) => { const full = `/${locale}${href}`; return path === full || path.startsWith(full + '/') }
  useEffect(() => {
    const close = (e?: Event) => document.querySelectorAll<HTMLDetailsElement>('.v-nav__services[open],.v-burger[open]').forEach((d) => { if (!e || !('target' in e) || !d.contains(e.target as Node)) d.removeAttribute('open') })
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', onKey); document.addEventListener('click', close)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('click', close) }
  }, [])
  useEffect(() => { document.querySelectorAll('.v-burger[open],.v-nav__services[open]').forEach((d) => d.removeAttribute('open')) }, [path])
  return (
    <>
      <nav className="v-nav" aria-label={words.main}>
        {items.map((item) => item.href === '/services' ? (
          <details className="v-nav__services" key={item.href}>
            <summary aria-current={here('/services') ? 'page' : undefined}>{item.label}</summary>
            <div className="v-mega">
              {groups.map((g) => (
                <div key={g.slug}>
                  <h4><a href={`/${locale}/services/${g.slug}`}>{g.name}</a></h4>
                  {g.modes.map((m) => <a key={m.slug} href={`/${locale}/services/${g.slug}/${m.slug}`}>{m.name}</a>)}
                </div>
              ))}
              <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--hair)', paddingTop: 14 }}><a href={`/${locale}/services`} className="v-link" style={{ display: 'inline', color: 'var(--ink)' }}>{words.allServices}</a></div>
            </div>
          </details>
        ) : <a key={item.href} href={`/${locale}${item.href}`} aria-current={here(item.href) ? 'page' : undefined}>{item.label}</a>)}
      </nav>
      <details className="v-burger">
        <summary aria-label={words.open}>
          <svg width="20" height="14" viewBox="0 0 20 14" aria-hidden="true"><path d="M0 1h20M0 7h20M0 13h20" stroke="currentColor" strokeWidth="2" /></svg>
        </summary>
        <nav className="v-burger__panel" aria-label={words.mobile}>
          <a href={`/${locale}`}>{words.home}</a>
          {items.map((item) => item.href === '/services' ? (
            <details key={item.href}>
              <summary>{item.label}</summary>
              <a href={`/${locale}/services`}>{words.allServices}</a>
              {groups.map((g) => <a key={g.slug} href={`/${locale}/services/${g.slug}`}>{g.name}</a>)}
            </details>
          ) : <a key={item.href} href={`/${locale}${item.href}`}>{item.label}</a>)}
          <a href={`/${locale}/request-quote`} style={{ color: 'var(--red)' }}>{rfq}</a>
        </nav>
      </details>
    </>
  )
}
