import { AdminPage, type Notices } from '@/components/admin/AdminPage'
import { many, type Row } from '@/server/data'
import { PUBLISH_LABEL, label } from '@/server/finance/labels'

export default async function Pages({ searchParams }: { searchParams: Promise<Notices> }) {
  const rows = await pageRows()
  return (
    <AdminPage heading="Pages & Sections" sp={await searchParams} newHref="/admin/pages/new" newLabel="New page">
      <div className="admin-panel">
        <p className="muted">Page and section changes must be published explicitly. This system renders published snapshots for visitors.</p>
        <table><thead><tr><th>Page</th><th>Locale</th><th>Status</th><th>Sections</th><th></th></tr></thead><tbody>
          {rows.length ? rows.map((r) => (
            <tr key={r.id as number}>
              <td><a href={`/admin/pages/${r.id}`}>{r.title as string}</a><br /><small>/{r.locale as string}/{r.slug as string}</small></td>
              <td>{r.locale as string}</td><td><span className="status">{label(PUBLISH_LABEL, r.status)}</span></td><td>{r.sections as number}</td><td><a href={`/admin/pages/${r.id}`}>Customize</a></td>
            </tr>
          )) : <tr><td colSpan={5}>Create a new page to start.</td></tr>}
        </tbody></table>
      </div>
    </AdminPage>
  )
}

/** Pages with the number of sections each has. */
async function pageRows(): Promise<Row[]> {
  const pages = await many('pages', (q) => q.order('id', { ascending: false }), 'id,title,slug,locale,status')
  const sections = await many('sections', (q) => q, 'page_id')
  const counts = new Map<number, number>()
  for (const s of sections) counts.set(s.pageId as number, (counts.get(s.pageId as number) ?? 0) + 1)
  return pages.map((p) => ({ ...p, sections: counts.get(p.id as number) ?? 0 }))
}
