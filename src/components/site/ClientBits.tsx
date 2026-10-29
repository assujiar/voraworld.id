'use client'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

/** Language switch: same page in the other language (the path is only known on the client). */
export function LangSwitch({ locale }: { locale: 'en' | 'id' }) {
  const pathname = usePathname() || `/${locale}`
  const other = locale === 'en' ? 'id' : 'en'
  const rest = pathname.replace(/^\/(en|id)(?=\/|$)/, '')
  return (
    <a className="langlink" href={`/${other}${rest}`} lang={other} aria-label={locale === 'en' ? 'Ganti ke Bahasa Indonesia' : 'Switch to English'}>
      {locale === 'en' ? 'ID' : 'EN'}
    </a>
  )
}

/** Escape closes open menus; clicking outside closes the services mega menu. */
export function MenuBehavior() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') document.querySelectorAll('.nav-services[open],.mobile-nav[open]').forEach((d) => d.removeAttribute('open'))
    }
    const onClick = (e: MouseEvent) => {
      document.querySelectorAll('.nav-services[open]').forEach((d) => { if (!d.contains(e.target as Node)) d.removeAttribute('open') })
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('click', onClick)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('click', onClick) }
  }, [])
  return null
}
