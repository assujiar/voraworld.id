import { notFound } from 'next/navigation'
import { AdminPage, type Notices } from '@/components/admin/AdminPage'
import { DocumentForm } from '@/components/admin/DocumentForm'
import { documentType, type Lang } from '@/content/document-types'
import { one } from '@/server/data'
import { routeId } from '@/server/http'
import type { StoredFields } from '@/server/documents/general'

export default async function EditDocument({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Notices> }) {
  const id = routeId((await params).id)
  const doc = id > 0 && id < 2_147_483_647 ? await one('documents', (q) => q.eq('id', id)) : undefined
  const type = doc ? documentType(doc.kind as string) : undefined
  if (!doc || !type) notFound()
  const stored = doc.fields as StoredFields
  return (
    <AdminPage heading={`Edit ${doc.number as string}`} sp={await searchParams}>
      {doc.status !== 'draft'
        ? <div className="admin-panel"><p>Only a draft can be edited. <a href={`/admin/documents/${id}`}>Back to the document</a></p></div>
        : <DocumentForm type={type} lang={doc.language as Lang} record={id} values={stored.values} documentDate={doc.documentDate as string} customerId={doc.customerId as number | null} invoiceIds={(stored.invoices ?? []).map((i) => i.id)} />}
    </AdminPage>
  )
}
