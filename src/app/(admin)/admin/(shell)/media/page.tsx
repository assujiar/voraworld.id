import { uploadMediaAction } from '@/actions/content'
import { AdminPage, Back, type Notices } from '@/components/admin/AdminPage'
import { many } from '@/server/data'
import { AsyncButton } from '@/components/feedback/AsyncButton'
import { PendingForm } from '@/components/feedback/scope'

export default async function Media({ searchParams }: { searchParams: Promise<Notices> }) {
  const rows = await many('media', (q) => q.order('id', { ascending: false }), 'id,filename,url,alt,size', 80)
  return (
    <AdminPage heading="Media library" sp={await searchParams}>
      <div className="admin-panel">
        <h3>Upload to media library</h3>
        <PendingForm action={uploadMediaAction}><Back to="/admin/media" />
          <div className="admin-form-grid">
            <div className="field"><label>Image</label><input type="file" name="image" accept="image/png,image/jpeg,image/webp,image/avif" /></div>
            <div className="field"><label>Alt text</label><input name="alt" required /></div>
          </div>
          <AsyncButton className="button">Upload</AsyncButton>
        </PendingForm>
        <p className="note">Local development stores files in <code>.local-storage</code>. Production requires configured Supabase object storage.</p>
        <div className="editorial-grid">
          {rows.map((m) => (
            <div className="card span-4" key={m.id as number}>
              <img src={m.url as string} alt={m.alt as string} style={{ height: 135, objectFit: 'contain' }} />
              <p className="mini">{m.filename as string} · {m.size as number} bytes</p><p className="mini">{m.alt as string}</p>
              <code className="mini" style={{ overflowWrap: 'anywhere' }}>{m.url as string}</code>
            </div>
          ))}
        </div>
      </div>
    </AdminPage>
  )
}
