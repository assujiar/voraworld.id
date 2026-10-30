import { addRedirectAction } from '@/actions/settings'
import { AdminPage, Back, type Notices } from '@/components/admin/AdminPage'
import { many } from '@/server/data'

export default async function Seo({ searchParams }: { searchParams: Promise<Notices> }) {
  const rows = await many('seo_redirects', (q) => q.order('id'), 'old_path,new_path,status')
  return (
    <AdminPage heading="SEO & redirects" sp={await searchParams}>
      <div className="admin-panel">
        <h3>SEO controls</h3>
        <p>Public HTML uses per-page metadata, canonical URLs, alternate language links and JSON-LD for verified organization data. The sitemap includes published routes and published articles.</p>
        <p><a href="/sitemap.xml">View sitemap</a> · <a href="/robots.txt">View robots.txt</a></p>
        <h3>301 redirects</h3>
        <form action={addRedirectAction}><Back to="/admin/seo" />
          <div className="admin-form-grid">
            <div className="field"><label>Old public path</label><input name="old_path" placeholder="/en/old" required /></div>
            <div className="field"><label>New public path</label><input name="new_path" placeholder="/en/new" required /></div>
          </div>
          <button className="button">Create redirect</button>
        </form>
        <table><thead><tr><th>From</th><th>To</th><th>Type</th></tr></thead><tbody>
          {rows.map((r, i) => <tr key={i}><td>{r.oldPath as string}</td><td>{r.newPath as string}</td><td>{r.status as number}</td></tr>)}
        </tbody></table>
      </div>
    </AdminPage>
  )
}
