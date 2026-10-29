import { CtaBand } from './CtaBand'
import { CustomSections } from './CustomSections'
import type { Locale } from '@/content'
import type { PageSnapshot } from '@/server/site'

export function CustomPageView({ locale, page }: { locale: Locale; page: PageSnapshot }) {
  return (
    <>
      <section className="page-intro"><div className="wrap"><span className="eyebrow">VORA / {page.title}</span><h1>{page.title}</h1><p>{page.description}</p></div></section>
      <CustomSections locale={locale} sections={page.sections} />
      <CtaBand locale={locale} />
    </>
  )
}
