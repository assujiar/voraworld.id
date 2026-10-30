import { restoreArticleAction, saveArticleAction } from '@/actions/content'
import { ArticleBodyEditor } from './ArticleBodyEditor'
import { Back, fmt } from './AdminPage'
import type { ArticlesRow } from '@/server/schema'
import { Autosave } from './Autosave'
import { AsyncButton } from '@/components/feedback/AsyncButton'
import { PendingForm } from '@/components/feedback/scope'

export function ArticleForm({ obj, revisions }: { obj: ArticlesRow | null; revisions: Array<{ id: number; createdAt: Date }> }) {
  const back = obj ? `/admin/articles/${obj.id}` : '/admin/articles/new'
  return (
    <div className="admin-panel">
      <h3>{obj ? 'Edit article' : 'New article'}{obj ? <span className="status">{obj.status}</span> : null}</h3>
      <PendingForm action={saveArticleAction} id="article-form">
        <input type="hidden" name="record" value={obj?.id ?? ''} /><Back to={back} />
        <div className="admin-form-grid">
          <div className="field"><label>Title *</label><input name="title" defaultValue={obj?.title ?? ''} required /></div>
          <div className="field"><label>Slug</label><input name="slug" defaultValue={obj?.slug ?? ''} placeholder="Generated from title" /></div>
          <div className="field"><label>Locale</label><select name="locale" defaultValue={obj?.locale ?? 'en'}><option>en</option><option>id</option></select></div>
          <div className="field"><label>Category</label><input name="category" defaultValue={obj?.category ?? 'Updates'} /></div>
          <div className="field"><label>Tags (comma separated)</label><input name="tags" defaultValue={obj?.tags ?? ''} /></div>
          <div className="field"><label>Author</label><input name="author" defaultValue={obj?.author ?? 'VORA Editorial'} /></div>
          <div className="field wide"><label>Excerpt</label><textarea rows={2} name="excerpt" defaultValue={obj?.excerpt ?? ''} /></div>
          <div className="field"><label>SEO title</label><input maxLength={200} name="seo_title" defaultValue={obj?.seoTitle ?? ''} /></div>
          <div className="field"><label>SEO description</label><input maxLength={300} name="seo_description" defaultValue={obj?.seoDescription ?? ''} /></div>
        </div>
        <ArticleBodyEditor initialHtml={obj?.body ?? ''} />
        {obj && obj.status === 'draft' ? <Autosave kind="article" id={obj.id} base={obj.updatedAt.toISOString()} /> : null}
        <div className="inline-actions">
          <AsyncButton className="button" name="action" value="draft" type="submit" action="article.draft">Save draft</AsyncButton>
          {obj ? <>
            <AsyncButton className="button" name="action" value="publish" type="submit" action="article.publish">Publish</AsyncButton>
            <AsyncButton className="button-outline" name="action" value="unpublish" type="submit" action="article.unpublish">Unpublish</AsyncButton>
            <a className="button-outline" href={`/${obj.locale}/preview/article/${obj.id}`} target="_blank" rel="noopener">Preview draft ↗</a>
          </> : null}
        </div>
      </PendingForm>
      {obj && revisions.length ? <>
        <h3 style={{ marginTop: 25 }}>Revision history</h3>
        {revisions.map((r) => (
          <PendingForm key={r.id} action={restoreArticleAction} className="inline-actions" style={{ marginBottom: 8 }}>
            <input type="hidden" name="record" value={obj.id} /><input type="hidden" name="revision" value={r.id} /><Back to={back} />
            <span>{fmt(r.createdAt)}</span><AsyncButton className="button-outline" type="submit">Restore revision #{r.id}</AsyncButton>
          </PendingForm>
        ))}
      </> : null}
    </div>
  )
}
