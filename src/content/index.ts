import data from './site.json'

export type Locale = 'en' | 'id'
export const LOCALES: readonly Locale[] = ['en', 'id'] as const
export const isLocale = (v: string): v is Locale => v === 'en' || v === 'id'

export interface ServiceCopy { name: string; strap: string; intro: string; scope: string; process: string; audience: string; proof: string }
export interface ServiceGroup { en: ServiceCopy; id: ServiceCopy; image: string; index: string; modes: string[] }
/** [name, lead, scope, image] */
export type ModeCopy = [string, string, string, string]

export const serviceGroups = data.serviceGroups as unknown as Record<string, ServiceGroup>
export const serviceModes = data.serviceModes as unknown as Record<string, Record<string, Record<Locale, ModeCopy>>>
export const siteText = data.text as unknown as Record<Locale, Record<string, string>>
export const navDefaults = data.nav as unknown as Array<[string, string]>
export const navLabels = data.navLabels as unknown as Record<Locale, Record<string, string>>
export const seoTitles = data.seoTitles as unknown as Record<Locale, Record<string, string>>
export const seoDescription = data.seoDescription as unknown as Record<Locale, string>
export const solutions = data.solutions as unknown as Record<Locale, Array<[string, string]>>
export const serviceAliases = data.serviceAliases as unknown as Record<string, string>

/** Two-language inline copy: `t('English', 'Bahasa')`. */
export const makeT = (locale: Locale) => (en: string, id: string) => (locale === 'en' ? en : id)

export const CORE_PAGES = ['/', '/about', '/services', '/solutions', '/network', '/insights', '/faq', '/contact', '/request-quote', '/privacy', '/terms'] as const
