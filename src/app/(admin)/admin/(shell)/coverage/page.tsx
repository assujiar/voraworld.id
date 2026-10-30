import { addCoverageAction, toggleCoverageAction } from '@/actions/settings'
import { AdminPage, Back, type Notices } from '@/components/admin/AdminPage'
import { many } from '@/server/data'
import { AsyncButton } from '@/components/feedback/AsyncButton'
import { PendingForm } from '@/components/feedback/scope'

export default async function Coverage({ searchParams }: { searchParams: Promise<Notices> }) {
  const rows = await many('coverage', (q) => q.order('id', { ascending: false }), 'id,region,mode,active')
  return (
    <AdminPage heading="Verified coverage" sp={await searchParams}>
      <div className="admin-panel">
        <PendingForm action={addCoverageAction}><Back to="/admin/coverage" />
          <div className="admin-form-grid">
            <div className="field"><label>Verified region</label><input required name="region" /></div>
            <div className="field"><label>Service type</label><input name="mode" defaultValue="General freight inquiry" /></div>
          </div>
          <label><input type="checkbox" name="active" value="1" /> Publish as verified</label> <AsyncButton className="button">Add coverage</AsyncButton>
        </PendingForm>
        <table><thead><tr><th>Region</th><th>Mode</th><th>Published</th><th></th></tr></thead><tbody>
          {rows.map((r) => (
            <tr key={r.id as number}><td>{r.region as string}</td><td>{r.mode as string}</td><td>{String(r.active)}</td>
              <td><PendingForm action={toggleCoverageAction}><input type="hidden" name="record" value={r.id as number} /><Back to="/admin/coverage" /><AsyncButton className="button-outline">{r.active ? 'Unpublish' : 'Publish'}</AsyncButton></PendingForm></td></tr>
          ))}
        </tbody></table>
      </div>
    </AdminPage>
  )
}
