import { CtaBand } from './CtaBand'
import { CustomSections } from './CustomSections'
import type { Locale } from '@/content'
import type { PageSnapshot } from '@/server/site'

export function CustomPageView({ locale, page }: { locale: Locale; page: PageSnapshot }) {
  return (
    <>
      <section className="v-page"><div className="v-wrap"><h1>{page.title}</h1>{page.description ? <p className="v-lead">{page.description}</p> : null}</div></section>
      <CustomSections locale={locale} sections={page.sections} />
      <CtaBand locale={locale} />
    </>
  )
}
