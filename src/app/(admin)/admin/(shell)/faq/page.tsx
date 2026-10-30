import { addFaqAction, updateFaqAction } from '@/actions/content'
import { AdminPage, Back, type Notices } from '@/components/admin/AdminPage'
import { many } from '@/server/data'
import { AsyncButton } from '@/components/feedback/AsyncButton'
import { PendingForm } from '@/components/feedback/scope'

export default async function Faq({ searchParams }: { searchParams: Promise<Notices> }) {
  const rows = await many('faqs', (q) => q.order('position').order('id'), 'id,question,answer')
  return (
    <AdminPage heading="FAQs" sp={await searchParams}>
      <div className="admin-panel">
        <h3>Add FAQ</h3>
        <PendingForm action={addFaqAction}><Back to="/admin/faq" />
          <div className="field"><label>Question</label><input name="question" required /></div>
          <div className="field"><label>Answer</label><textarea name="answer" required /></div>
          <AsyncButton className="button">Add FAQ</AsyncButton>
        </PendingForm>
        <h3 style={{ marginTop: 30 }}>Published FAQs</h3>
        {rows.map((r) => (
          <div key={r.id as number}>
            <PendingForm action={updateFaqAction}><input type="hidden" name="record" value={r.id as number} /><Back to="/admin/faq" />
              <div className="field"><input name="question" defaultValue={r.question as string} /></div>
              <div className="field"><textarea name="answer" defaultValue={r.answer as string} /></div>
              <div className="inline-actions"><AsyncButton className="button">Update</AsyncButton><AsyncButton className="button-outline" name="delete" value="1">Delete</AsyncButton></div>
            </PendingForm><hr />
          </div>
        ))}
      </div>
    </AdminPage>
  )
}
