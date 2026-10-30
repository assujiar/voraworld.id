import { AdminPage, type Notices } from '@/components/admin/AdminPage'
import { DocumentForm } from '@/components/admin/DocumentForm'
import { documentType, isLang } from '@/content/document-types'
import { sql } from '@/server/db'

export default async function NewDocument({ searchParams }: { searchParams: Promise<Notices & { type?: string; lang?: string; customer?: string }> }) {
  const sp = await searchParams
  const type = documentType(sp.type ?? '')
  const lang = isLang(sp.lang) ? sp.lang : 'id'
  const customerId = /^\d{1,10}$/.test(sp.customer ?? '') && Number(sp.customer) <= 2_147_483_647 ? Number(sp.customer) : null
  const [customer] = customerId ? await sql`select id from customers where id = ${customerId}` : []
  return (
    <AdminPage heading="New document" sp={sp}>
      {!type ? <div className="admin-panel"><p>Choose a document type first. <a href="/admin/documents">Back to the list</a></p></div>
        : type.family === 'billing' && !customer ? <div className="admin-panel"><p>A billing letter is written to a customer: choose one on <a href="/admin/documents">the previous page</a>.</p></div>
          : <DocumentForm type={type} lang={lang} customerId={customer ? (customer.id as number) : null} />}
    </AdminPage>
  )
}
