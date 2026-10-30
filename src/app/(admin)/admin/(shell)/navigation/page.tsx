import { addNavigationAction, deleteNavigationAction } from '@/actions/content'
import { AdminPage, Back, type Notices } from '@/components/admin/AdminPage'
import { many } from '@/server/data'
import { AsyncButton } from '@/components/feedback/AsyncButton'
import { PendingForm } from '@/components/feedback/scope'

export default async function Navigation({ searchParams }: { searchParams: Promise<Notices> }) {
  const rows = await many('navigation_items', (q) => q.order('position').order('id'), 'id,label,href,location')
  return (
    <AdminPage heading="Navigation" sp={await searchParams}>
      <div className="admin-panel">
        <PendingForm action={addNavigationAction}><Back to="/admin/navigation" />
          <div className="admin-form-grid">
            <div className="field"><label>Label</label><input name="label" required /></div>
            <div className="field"><label>Path</label><input name="href" required placeholder="/about" /></div>
            <div className="field"><label>Location</label><select name="location"><option>header</option><option>footer</option></select></div>
            <div className="field"><label>Position</label><input type="number" name="position" defaultValue={50} /></div>
          </div>
          <AsyncButton className="button">Add item</AsyncButton>
        </PendingForm>
        <table><tbody>
          {rows.map((r) => (
            <tr key={r.id as number}><td>{r.label as string}</td><td>{r.href as string}</td><td>{r.location as string}</td>
              <td><PendingForm action={deleteNavigationAction}><input type="hidden" name="record" value={r.id as number} /><Back to="/admin/navigation" /><AsyncButton className="button-outline">Delete</AsyncButton></PendingForm></td></tr>
          ))}
        </tbody></table>
      </div>
    </AdminPage>
  )
}
