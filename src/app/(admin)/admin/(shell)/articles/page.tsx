import { AdminPage, day, type Notices } from '@/components/admin/AdminPage'
import { sql } from '@/server/db'

export default async function Articles({ searchParams }: { searchParams: Promise<Notices> }) {
  const rows = await sql`select id, title, slug, locale, status, updated_at from articles order by updated_at desc`
  return (
    <AdminPage heading="Articles" sp={await searchParams} newHref="/admin/articles/new" newLabel="New article">
      <div className="admin-panel"><table><thead><tr><th>Title</th><th>Locale</th><th>Status</th><th>Updated</th><th></th></tr></thead><tbody>
        {rows.length ? rows.map((r) => (
          <tr key={r.id as number}>
            <td><a href={`/admin/articles/${r.id}`}>{r.title as string}</a><br /><small>/{r.locale as string}/insights/{r.slug as string}</small></td>
            <td>{r.locale as string}</td><td><span className="status">{r.status as string}</span></td><td>{day(r.updatedAt as Date)}</td><td><a href={`/admin/articles/${r.id}`}>Edit</a></td>
          </tr>
        )) : <tr><td colSpan={5}>No articles. New content starts as a draft.</td></tr>}
      </tbody></table></div>
    </AdminPage>
  )
}
