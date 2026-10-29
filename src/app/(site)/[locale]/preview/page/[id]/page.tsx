import { notFound } from 'next/navigation'
import { CustomPageView } from '@/components/site/CustomPageView'
import { localeOf } from '@/lib/page'
import { snapshotPage } from '@/server/cms'
import { sql } from '@/server/db'
import { requirePageUser } from '@/server/page-auth'
import type { PagesRow } from '@/server/schema'
import type { PageSnapshot } from '@/server/site'
import { routeId } from '@/server/http'

export const metadata = { title: { absolute: 'Preview | VORA' }, robots: { index: false, follow: false } }

export default async function PreviewPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  await requirePageUser()
  const { id } = await params
  const locale = await localeOf(params)
  const [p] = await sql`select * from pages where id = ${routeId(id)}`
  if (!p) notFound()
  return <CustomPageView locale={locale} page={(await snapshotPage(sql, p as PagesRow)) as unknown as PageSnapshot} />
}
