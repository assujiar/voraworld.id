'use client'
import { useEffect, useRef, useState } from 'react'

type Mode = 'visual' | 'html' | 'preview'
type Preview = { subject:string; html:string }

/** One HTML document, three views. Source changes update rich text on the next switch; rich edits update source immediately. */
export function BroadcastEditor({ initialHtml, initialSubject }: { initialHtml: string; initialSubject: string }) {
  const [mode,setMode]=useState<Mode>('visual')
  const [html,setHtml]=useState(initialHtml)
  const [subject,setSubject]=useState(initialSubject)
  const [preview,setPreview]=useState<Preview | null>(null)
  const [previewError,setPreviewError]=useState('')
  const [syncError,setSyncError]=useState('')
  const [syncing,setSyncing]=useState(false)
  const rich=useRef<HTMLDivElement>(null)
  useEffect(()=>{ if(mode==='visual' && rich.current && rich.current.innerHTML!==html) rich.current.innerHTML=html },[mode]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>{
    if(mode!=='preview') return
    const c=new AbortController()
    const id=setTimeout(()=>{
      fetch('/admin/api/broadcast/preview',{method:'POST',headers:{'content-type':'application/json'},signal:c.signal,body:JSON.stringify({html,subject})})
        .then(async(res)=>{if(!res.ok)throw new Error('Preview could not be generated');return res.json() as Promise<Preview>})
        .then(setPreview).catch(()=>{if(!c.signal.aborted)setPreviewError('Preview could not be generated')})
    },300)
    setPreview(null);setPreviewError('')
    return()=>{clearTimeout(id);c.abort()}
  },[html,subject,mode])
  const exec=(cmd:string,arg?:string)=>{
    rich.current?.focus()
    document.execCommand(cmd,false,arg)
    setHtml(rich.current?.innerHTML ?? html)
  }
  const link=()=>{const url=window.prompt('HTTPS URL:');if(url && /^https:\/\/[^\s]+$/i.test(url))exec('createLink',url)}
  const addImage=()=>{const url=window.prompt('Image URL on https://voraworld.id/static/assets/:');if(url && /^https:\/\/(?:www\.)?voraworld\.id\/static\/assets\/[a-z0-9._/-]+$/i.test(url)) exec('insertImage',url)}
  const switchMode=async(next:Mode)=>{
    if(mode==='visual') setHtml(rich.current?.innerHTML ?? html)
    if(next==='visual' && mode==='html') {
      setSyncing(true);setSyncError('')
      try {
        const response=await fetch('/admin/api/broadcast/sanitize',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({html})})
        if(!response.ok)throw new Error('Could not sanitise the HTML source')
        const safe=await response.json() as {html:string}
        setHtml(safe.html)
      } catch {setSyncError('Cannot switch to Rich Text until the HTML is sanitised.');setSyncing(false);return}
      setSyncing(false)
    }
    setMode(next)
  }
  return <div className="broadcast-editor">
    <div className="field"><label htmlFor="broadcast-subject">Email subject *</label><input id="broadcast-subject" value={subject} onChange={(e)=>setSubject(e.target.value)} maxLength={200} required /></div>
    <input type="hidden" name="subject" value={subject}/><input type="hidden" name="html" value={html}/>
    {syncError?<p className="alert" role="alert">{syncError}</p>:null}
    <div className="broadcast-mode" role="tablist" aria-label="Email editor mode">
      {(['visual','html','preview'] as const).map(m=><button type="button" role="tab" aria-selected={mode===m} className={mode===m?'active':''} key={m} disabled={syncing} onClick={()=>void switchMode(m)}>{m==='visual'?'Rich Text':m==='html'?'HTML Source':'Live Preview'}</button>)}
    </div>
    <div className={mode==='visual'?'':'hide'}>
      <div className="rich-toolbar" role="toolbar" aria-label="Rich text formatting">
        <button type="button" onClick={()=>exec('bold')}><b>B</b></button><button type="button" onClick={()=>exec('italic')}><i>I</i></button>
        <button type="button" onClick={()=>exec('underline')}><u>U</u></button><button type="button" onClick={()=>exec('insertUnorderedList')}>Bullets</button>
        <button type="button" onClick={()=>exec('insertOrderedList')}>Numbers</button><button type="button" onClick={()=>exec('formatBlock','h2')}>H2</button>
        <button type="button" onClick={()=>exec('formatBlock','h3')}>H3</button><button type="button" onClick={link}>Link</button><button type="button" onClick={addImage}>Image</button>
        <button type="button" onClick={()=>exec('undo')}>Undo</button><button type="button" onClick={()=>exec('redo')}>Redo</button>
      </div>
      <div ref={rich} className="broadcast-rich" contentEditable suppressContentEditableWarning role="textbox" aria-label="Email rich text" onInput={(e)=>setHtml(e.currentTarget.innerHTML)} onPaste={(e)=>{
          e.preventDefault();document.execCommand('insertText',false,e.clipboardData.getData('text/plain'))
          setHtml(rich.current?.innerHTML ?? '')
        }} dangerouslySetInnerHTML={{__html:initialHtml}} />
    </div>
    {mode==='html'?<div className="field"><label htmlFor="broadcast-html">HTML source</label><textarea id="broadcast-html" rows={18} spellCheck={false} value={html} onChange={(e)=>setHtml(e.target.value)}/></div>:null}
    {mode==='preview'?<div className="broadcast-preview">
      <div><strong>Rendered email preview</strong><span className="muted mini"> · example contact data and unsubscribe footer</span></div>
      {previewError?<p className="alert" role="alert">{previewError}</p>:preview?<><p><strong>Subject:</strong> {preview.subject}</p>
        <iframe sandbox="" title="Email preview" srcDoc={`<!doctype html><meta charset="utf-8"><body style="margin:16px;font-family:Arial,sans-serif">${preview.html}</body>`}/></>:<p className="muted mini">Rendering preview…</p>}
    </div>:null}
    <p className="mini muted">Personalization: {'{{company_name}}'}, {'{{pic_name}}'}, {'{{position}}'}, {'{{email}}'}. Unsubscribe footer is added automatically. Images are restricted to VORA-hosted static assets.</p>
  </div>
}
