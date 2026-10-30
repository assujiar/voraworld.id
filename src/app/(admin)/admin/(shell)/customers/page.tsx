import { AdminPage, type Notices } from '@/components/admin/AdminPage'
import { many, searchClause } from '@/server/data'
import { AsyncButton } from '@/components/feedback/AsyncButton'
import { StepForm } from '@/components/feedback/StepForm'

export default async function Customers({ searchParams }: { searchParams: Promise<Notices & { q?: string }> }) {
  const sp = await searchParams
  const q = (sp.q ?? '').trim().slice(0, 120)
  const clause = await searchClause(q, ['name', 'email', 'public_code', 'phone', 'pic_name', 'pic_email', 'pic_phone'])
  const rows = await many('customers', (f) => (clause ? f.or(clause) : f).order('id', { ascending: false }), 'id,name,email,phone,pic_name,pic_email,pic_phone,currency,terms_days,public_code', 300)
  return (
    <AdminPage heading="Customers" sp={sp} newHref="/admin/customers/new" newLabel="New customer">
      <div className="admin-panel">
        <p className="note">A customer is where every commercial document starts: a quotation can be made for a customer directly, or after a lead is saved as one.</p>
        <StepForm className="inline-actions" style={{ marginBottom: 14 }}>
          <input name="q" defaultValue={q} placeholder="Search company, owner code, email, contact person or phone" style={{ minWidth: 320 }} />
          <AsyncButton className="button" busy="Mencari Customer…">Search</AsyncButton>
        </StepForm>
        <table><thead><tr><th>Company / person</th><th>Contact person</th><th>Email / phone</th><th>Currency</th><th>Terms</th><th></th></tr></thead><tbody>
          {rows.length ? rows.map((r) => (
            <tr key={r.id as number}>
              <td><a href={`/admin/customers/${r.id}`}>{r.name as string}</a><small> · {(r.publicCode as string) || 'Legacy customer'}</small></td>
              <td>{(r.picName as string) || '-'}</td>
              <td>{(r.picEmail as string) || (r.email as string) || '-'}<br /><small className="muted">{(r.picPhone as string) || (r.phone as string) || ''}</small></td>
              <td>{r.currency as string}</td><td>{r.termsDays as number} days</td>
              <td><a className="button-outline" href={`/admin/quotations/new?customer=${r.id}`}>Buat Quotation</a></td>
            </tr>
          )) : <tr><td colSpan={6}>{q ? 'No customer matches that search.' : 'No customers yet.'}</td></tr>}
        </tbody></table>
      </div>
    </AdminPage>
  )
}
