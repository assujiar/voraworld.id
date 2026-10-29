import { notFound, permanentRedirect, redirect } from 'next/navigation'
import { CtaBand } from '@/components/site/CtaBand'
import { CustomSections } from '@/components/site/CustomSections'
import { isLocale } from '@/content'
import { pageMetadata } from '@/lib/metadata'
import { findRedirect, getPublishedPage } from '@/server/site'

type P = { params: Promise<{ locale: string; slug: string[] }> }
const route = (slug: string[]) => slug.join('/')

export async function generateMetadata({ params }: P) {
  const { locale, slug } = await params
  if (!isLocale(locale)) return {}
  const page = await getPublishedPage(route(slug), locale)
  if (!page) return {}
  return pageMetadata({ locale, path: '/' + route(slug), title: page.seo_title || page.title, description: page.seo_description || page.description })
}

/** CMS pages (published snapshots) and administrator-managed redirects. Anything else is a 404. */
export default async function CustomPage({ params }: P) {
  const { locale, slug } = await params
  if (!isLocale(locale) || slug.some((s) => !s || s === '..') || route(slug).length > 400) notFound()
  const hit = await findRedirect(`/${locale}/${route(slug)}`)
  if (hit && hit.newPath.startsWith('/') && !hit.newPath.startsWith('//')) (hit.status === 301 ? permanentRedirect : redirect)(hit.newPath)
  const page = await getPublishedPage(route(slug), locale)
  if (!page) notFound()
  return (
    <>
      <section className="page-intro"><div className="wrap"><span className="eyebrow">VORA / {page.title}</span><h1>{page.title}</h1><p>{page.description}</p></div></section>
      <CustomSections locale={locale} sections={page.sections} />
      <CtaBand locale={locale} />
    </>
  )
}
