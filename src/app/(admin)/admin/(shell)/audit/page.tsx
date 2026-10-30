import { AdminPage, fmt, type Notices } from '@/components/admin/AdminPage'
import { many } from '@/server/data'

export default async function Audit({ searchParams }: { searchParams: Promise<Notices> }) {
  const rows = await many('audit_logs', (q) => q.order('id', { ascending: false }), 'created_at,actor_id,verb,object_type,object_id,summary', 200)
  return (
    <AdminPage heading="Audit log" sp={await searchParams}>
      <div className="admin-panel"><table><thead><tr><th>Timestamp</th><th>Actor ID</th><th>Action</th><th>Resource</th><th>Summary</th></tr></thead><tbody>
        {rows.map((r, i) => <tr key={i}><td>{fmt(r.createdAt as Date)}</td><td>{(r.actorId as number) ?? 'CLI'}</td><td>{r.verb as string}</td><td>{r.objectType as string} #{r.objectId as number}</td><td>{r.summary as string}</td></tr>)}
      </tbody></table></div>
    </AdminPage>
  )
}
