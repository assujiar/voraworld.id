'use client'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

/**
 * Language switch: the same page in the other language.
 * - On the quotation form the chosen service travels along, but only when it is one of the services the site knows (`modes`): nothing else in the
 *   address, and no form content, is ever copied into the link.
 * - An article whose other-language version has a different address (its page declares it as an alternate) links to that address.
 * The link is correct without JavaScript for ordinary pages; the two refinements above are added once the page has loaded.
 */
export function LangSwitch({ locale, named = false, modes = [] }: { locale: 'en' | 'id'; named?: boolean; modes?: string[] }) {
  const pathname = usePathname() || `/${locale}`
  const other = locale === 'en' ? 'id' : 'en'
  const rest = pathname.replace(/^\/(en|id)(?=\/|$)/, '')
  const [href, setHref] = useState(/^\/insights\/[^/]+/.test(rest) ? `/${other}/insights` : `/${other}${rest}`)
  useEffect(() => {
    let next = `/${other}${rest}`
    if (/^\/request-quote\/?$/.test(rest)) {
      const mode = new URLSearchParams(window.location.search).get('mode') ?? ''
      if (mode && modes.includes(mode)) next += `?mode=${encodeURIComponent(mode)}`
    }
    if (/^\/insights\/[^/]+/.test(rest)) {
      const alt = document.head.querySelector<HTMLLinkElement>(`link[rel="alternate"][hreflang="${other}"]`)?.href
      // An article that exists in one language only declares no alternate: the switch then lands on the other language's article list, not a 404.
      next = `/${other}/insights`
      try { if (alt) { const u = new URL(alt); if (u.pathname.startsWith(`/${other}/insights/`)) next = u.pathname } } catch { /* keep the list */ }
    }
    setHref(next)
  }, [pathname, rest, other, modes])
  return (
    <a className={named ? 'v-lang v-lang--named' : 'v-lang'} href={href} hrefLang={other} lang={other} aria-label={locale === 'en' ? 'Ganti ke Bahasa Indonesia' : 'Switch to English'}>
      {named ? (locale === 'en' ? 'Bahasa Indonesia' : 'English') : locale === 'en' ? 'ID' : 'EN'}
    </a>
  )
}
