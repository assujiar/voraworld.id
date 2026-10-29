'use client'
import { useRef, useState } from 'react'

/**
 * Rich-text + raw-HTML editor for article bodies. The content lives in the DOM (uncontrolled), so typing never
 * re-renders it and the cursor never jumps; a hidden `body` input always carries the current HTML to the form.
 * The server sanitises whatever arrives.
 */
export function ArticleBodyEditor({ initialHtml }: { initialHtml: string }) {
  const rich = useRef<HTMLDivElement>(null)
  const source = useRef<HTMLTextAreaElement>(null)
  const field = useRef<HTMLInputElement>(null)
  const [sourceMode, setSourceMode] = useState(false)

  const sync = (value?: string) => { if (field.current) field.current.value = value ?? (sourceMode ? source.current?.value ?? '' : rich.current?.innerHTML ?? '') }
  const exec = (cmd: string, arg?: string) => { rich.current?.focus(); document.execCommand(cmd, false, arg); sync() }

  const toggleSource = () => {
    if (!sourceMode) {
      if (source.current && rich.current) source.current.value = rich.current.innerHTML
      setSourceMode(true)
      sync(rich.current?.innerHTML ?? '')
    } else {
      if (source.current && rich.current) rich.current.innerHTML = source.current.value
      setSourceMode(false)
      sync(source.current?.value ?? '')
    }
  }
  const preview = () => {
    if (sourceMode) toggleSource()
    if (!rich.current) return
    rich.current.contentEditable = 'false'
    setTimeout(() => { if (rich.current) rich.current.contentEditable = 'true' }, 2000)
  }
  const addLink = () => {
    const url = window.prompt('HTTPS link URL:')
    if (url && /^https:\/\//i.test(url)) exec('createLink', url)
  }
  const addImage = () => {
    const url = window.prompt('HTTPS image URL (or /uploads/...):')
    if (url && (/^https:\/\//i.test(url) || url.startsWith('/uploads/'))) {
      const alt = window.prompt('Alternative text:') || 'Image'
      const esc = (v: string) => v.replace(/"/g, '&quot;')
      exec('insertHTML', `<figure><img src="${esc(url)}" alt="${esc(alt)}"></figure>`)
    }
  }
  const Btn = ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => <button type="button" onClick={onClick}>{children}</button>

  return (
    <div className="field">
      <label>Article body (rich text &amp; HTML)</label>
      <div className="rich-toolbar">
        <Btn onClick={() => exec('bold')}><b>B</b></Btn><Btn onClick={() => exec('italic')}><i>I</i></Btn><Btn onClick={() => exec('underline')}><u>U</u></Btn>
        <Btn onClick={() => exec('insertUnorderedList')}>Bullets</Btn><Btn onClick={() => exec('insertOrderedList')}>Numbers</Btn>
        <Btn onClick={() => exec('formatBlock', 'h2')}>H2</Btn><Btn onClick={() => exec('formatBlock', 'h3')}>H3</Btn><Btn onClick={() => exec('formatBlock', 'blockquote')}>Quote</Btn>
        <Btn onClick={addLink}>Link</Btn><Btn onClick={addImage}>Image</Btn><Btn onClick={() => exec('undo')}>Undo</Btn><Btn onClick={() => exec('redo')}>Redo</Btn>
        <Btn onClick={toggleSource}>HTML source</Btn><Btn onClick={preview}>Preview</Btn>
      </div>
      <div ref={rich} className={`rich-surface article-body ${sourceMode ? 'hide' : ''}`} contentEditable suppressContentEditableWarning role="textbox" aria-label="Article rich-text editor"
        onInput={() => sync()} dangerouslySetInnerHTML={{ __html: initialHtml }} />
      <textarea ref={source} className={`rich-html ${sourceMode ? '' : 'hide'}`} spellCheck={false} aria-label="Article HTML source" defaultValue={initialHtml} onInput={() => sync()} />
      <input type="hidden" name="body" ref={field} defaultValue={initialHtml} />
    </div>
  )
}
