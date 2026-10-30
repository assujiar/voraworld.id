'use client'
import { usePathname } from 'next/navigation'

/** Language switch: same page in the other language (the path is only known on the client). */
export function LangSwitch({ locale, named = false }: { locale: 'en' | 'id'; named?: boolean }) {
  const pathname = usePathname() || `/${locale}`
  const other = locale === 'en' ? 'id' : 'en'
  const rest = pathname.replace(/^\/(en|id)(?=\/|$)/, '')
  return (
    <a className={named ? 'v-lang v-lang--named' : 'v-lang'} href={`/${other}${rest}`} lang={other} aria-label={locale === 'en' ? 'Ganti ke Bahasa Indonesia' : 'Switch to English'}>
      {named ? (locale === 'en' ? 'Bahasa Indonesia' : 'English') : locale === 'en' ? 'ID' : 'EN'}
    </a>
  )
}
