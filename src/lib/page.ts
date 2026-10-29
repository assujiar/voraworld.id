import { notFound } from 'next/navigation'
import { isLocale, type Locale } from '@/content'

export type LocaleParams = { params: Promise<{ locale: string }> }

/** Resolves and validates the locale segment (404 for anything but en/id). */
export async function localeOf(params: LocaleParams['params']): Promise<Locale> {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  return locale
}
