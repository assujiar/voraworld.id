import { addSectionAction, restorePageAction, savePageAction, saveSectionAction } from '@/actions/content'
import { SECTION_KINDS, SECTION_LAYOUTS, SECTION_SURFACES } from '@/server/cms-constants'
import type { PagesRow, SectionsRow } from '@/server/schema'
import { Back, fmt } from './AdminPage'

export function PageForm({ obj, sections, revisions }: { obj: PagesRow | null; sections: SectionsRow[]; revisions: Array<{ id: number; createdAt: Date }> }) {
  const back = obj ? `/admin/pages/${obj.id}` : '/admin/pages/new'
  return (
    <>
      <div className="admin-panel">
        <h3>Page settings</h3>
        <form action={savePageAction}>
          <input type="hidden" name="id" value={obj?.id ?? ''} /><Back to={back} />
          <div className="admin-form-grid">
            <div className="field"><label>Page title</label><input required name="title" defaultValue={obj?.title ?? ''} /></div>
            <div className="field"><label>Slug</label><input name="slug" defaultValue={obj?.slug ?? ''} /></div>
            <div className="field"><label>Locale</label><select name="locale" defaultValue={obj?.locale ?? 'en'}><option>en</option><option>id</option></select></div>
            <div className="field"><label>SEO title</label><input name="seo_title" defaultValue={obj?.seoTitle ?? ''} /></div>
            <div className="field wide"><label>Excerpt / meta description</label><textarea name="description" defaultValue={obj?.description ?? ''} /></div>
          </div>
          <div className="inline-actions">
            <button className="button" name="action" value="draft">Save draft</button>
            {obj ? <>
              <button className="button" name="action" value="publish">Publish page</button>
              <button className="button-outline" name="action" value="unpublish">Unpublish</button>
              <a className="button-outline" href={`/${obj.locale}/preview/page/${obj.id}`} target="_blank" rel="noopener">Preview draft ↗</a>
            </> : null}
          </div>
        </form>
      </div>
      {obj ? <>
        <div className="admin-panel">
          <h3>Editorial sections <span className="muted mini">(ordered)</span></h3>
          {sections.map((sec, i) => (
            <div className="layout-preview" key={sec.id}>
              <form action={saveSectionAction}>
                <input type="hidden" name="id" value={sec.id} /><Back to={back} />
                <div className="inline-actions" style={{ marginBottom: 12 }}>
                  <strong>Section {i + 1}</strong><span className="status">{sec.kind} · {sec.layout}</span>
                  <button className="button-outline" name="move" value="up">↑ Up</button>
                  <button className="button-outline" name="move" value="down">↓ Down</button>
                  <button className="button-outline" name="delete" value="1">Delete</button>
                </div>
                <div className="admin-form-grid">
                  <div className="field"><label>Title</label><input name="title" defaultValue={sec.title} /></div>
                  <div className="field"><label>Kind</label><select name="kind" defaultValue={sec.kind}>{SECTION_KINDS.map((v) => <option key={v}>{v}</option>)}</select></div>
                  <div className="field"><label>Layout</label><select name="layout" defaultValue={sec.layout}>{SECTION_LAYOUTS.map((v) => <option key={v}>{v}</option>)}</select></div>
                  <div className="field"><label>Background</label><select name="surface" defaultValue={sec.surface}>{[...SECTION_SURFACES].reverse().map((v) => <option key={v}>{v}</option>)}</select></div>
                  <div className="field wide"><label>Body</label><textarea name="body" rows={3} defaultValue={sec.body} /></div>
                  <div className="field wide"><label>Image URL (choose from Media)</label><input name="image" defaultValue={sec.image} /></div>
                  <div className="field"><label>CTA label</label><input name="button_label" defaultValue={sec.buttonLabel} /></div>
                  <div className="field"><label>CTA path</label><input name="button_href" defaultValue={sec.buttonHref} /></div>
                  <div className="field"><label><input type="checkbox" name="visible" value="1" defaultChecked={sec.visible} /> Visible</label></div>
                </div>
                <button className="button" name="save" value="1">Save section</button>
              </form>
            </div>
          ))}
          <form action={addSectionAction}><input type="hidden" name="id" value={obj.id} /><Back to={back} /><button className="button-outline">+ Add editorial section</button></form>
        </div>
        {revisions.length ? (
          <div className="admin-panel"><h3>Published revisions</h3>
            {revisions.map((r) => (
              <form key={r.id} action={restorePageAction}><input type="hidden" name="id" value={obj.id} /><input type="hidden" name="revision" value={r.id} /><Back to={back} />
                {fmt(r.createdAt)} <button className="button-outline">Restore #{r.id}</button></form>
            ))}
          </div>
        ) : null}
      </> : null}
    </>
  )
}
