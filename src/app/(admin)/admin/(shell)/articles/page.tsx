import { AdminPage, day, type Notices } from '@/components/admin/AdminPage'
import { many } from '@/server/data'
import { PUBLISH_LABEL, label } from '@/server/finance/labels'

export default async function Articles({ searchParams }: { searchParams: Promise<Notices> }) {
  const rows = await many('articles', (q) => q.order('updated_at', { ascending: false }), 'id,title,slug,locale,status,updated_at')
  return (
    <AdminPage heading="Articles" sp={await searchParams} newHref="/admin/articles/new" newLabel="New article">
      <div className="admin-panel"><table><thead><tr><th>Title</th><th>Locale</th><th>Status</th><th>Updated</th><th></th></tr></thead><tbody>
        {rows.length ? rows.map((r) => (
          <tr key={r.id as number}>
            <td><a href={`/admin/articles/${r.id}`}>{r.title as string}</a><br /><small>/{r.locale as string}/insights/{r.slug as string}</small></td>
            <td>{r.locale as string}</td><td><span className="status">{label(PUBLISH_LABEL, r.status)}</span></td><td>{day(r.updatedAt as Date)}</td><td><a href={`/admin/articles/${r.id}`}>Edit</a></td>
          </tr>
        )) : <tr><td colSpan={5}>No articles. New content starts as a draft.</td></tr>}
      </tbody></table></div>
    </AdminPage>
  )
}
