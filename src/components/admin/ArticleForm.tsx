import { restoreArticleAction, saveArticleAction } from '@/actions/content'
import { ArticleBodyEditor } from './ArticleBodyEditor'
import { Back, fmt } from './AdminPage'
import type { ArticlesRow } from '@/server/schema'

export function ArticleForm({ obj, revisions }: { obj: ArticlesRow | null; revisions: Array<{ id: number; createdAt: Date }> }) {
  const back = obj ? `/admin/articles/${obj.id}` : '/admin/articles/new'
  return (
    <div className="admin-panel">
      <h3>{obj ? 'Edit article' : 'New article'}{obj ? <span className="status">{obj.status}</span> : null}</h3>
      <form action={saveArticleAction} id="article-form">
        <input type="hidden" name="id" value={obj?.id ?? ''} /><Back to={back} />
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
        <div className="inline-actions">
          <button className="button" name="action" value="draft" type="submit">Save draft</button>
          {obj ? <>
            <button className="button" name="action" value="publish" type="submit">Publish</button>
            <button className="button-outline" name="action" value="unpublish" type="submit">Unpublish</button>
            <a className="button-outline" href={`/${obj.locale}/preview/article/${obj.id}`} target="_blank" rel="noopener">Preview draft ↗</a>
          </> : null}
        </div>
      </form>
      {obj && revisions.length ? <>
        <h3 style={{ marginTop: 25 }}>Revision history</h3>
        {revisions.map((r) => (
          <form key={r.id} action={restoreArticleAction} className="inline-actions" style={{ marginBottom: 8 }}>
            <input type="hidden" name="id" value={obj.id} /><input type="hidden" name="revision" value={r.id} /><Back to={back} />
            <span>{fmt(r.createdAt)}</span><button className="button-outline" type="submit">Restore revision #{r.id}</button>
          </form>
        ))}
      </> : null}
    </div>
  )
}
