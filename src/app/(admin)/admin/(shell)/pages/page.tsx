import { AdminPage, type Notices } from '@/components/admin/AdminPage'
import { sql } from '@/server/db'

export default async function Pages({ searchParams }: { searchParams: Promise<Notices> }) {
  const rows = await sql`select p.id, p.title, p.slug, p.locale, p.status, (select count(*) from sections s where s.page_id = p.id)::int as sections from pages p order by p.id desc`
  return (
    <AdminPage heading="Pages & Sections" sp={await searchParams} newHref="/admin/pages/new" newLabel="New page">
      <div className="admin-panel">
        <p className="muted">Page and section changes must be published explicitly. This system renders published snapshots for visitors.</p>
        <table><thead><tr><th>Page</th><th>Locale</th><th>Status</th><th>Sections</th><th></th></tr></thead><tbody>
          {rows.length ? rows.map((r) => (
            <tr key={r.id as number}>
              <td><a href={`/admin/pages/${r.id}`}>{r.title as string}</a><br /><small>/{r.locale as string}/{r.slug as string}</small></td>
              <td>{r.locale as string}</td><td><span className="status">{r.status as string}</span></td><td>{r.sections as number}</td><td><a href={`/admin/pages/${r.id}`}>Customize</a></td>
            </tr>
          )) : <tr><td colSpan={5}>Create a new page to start.</td></tr>}
        </tbody></table>
      </div>
    </AdminPage>
  )
}
