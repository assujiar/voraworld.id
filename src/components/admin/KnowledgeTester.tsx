'use client'
import { useState, type FormEvent } from 'react'
import { changeAgentKnowledgeStatus } from '@/actions/agent-knowledge'

export function KnowledgeTester() {
  const [language,setLanguage] = useState<'en'|'id'>('en')
  const [question,setQuestion] = useState('Can VORA handle oversized cargo?')
  const [answer,setAnswer] = useState('')
  const [error,setError] = useState('')
  const [loading,setLoading] = useState(false)
  async function test(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const editor = document.getElementById('knowledge-editor') as HTMLFormElement | null
    if (!editor) return
    const data = new FormData(editor)
    setLoading(true); setError(''); setAnswer('')
    try {
      const r = await fetch('/admin/api/agent-knowledge/preview', {
        method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',
        body:JSON.stringify(Object.fromEntries([...data.entries(),['question',question],['locale',language]])),
      })
      const responseText = await r.text()
      let parsed: {reply?:string;error?:string;message?:string} = {}
      try { parsed = JSON.parse(responseText) } catch { parsed.error = responseText.slice(0, 240) }
      if (!r.ok || !parsed.reply) throw new Error(parsed.error || parsed.message || 'Preview unavailable')
      setAnswer(parsed.reply)
    } catch (err) {setError(err instanceof Error ? err.message : 'Unable to test knowledge')}
    finally {setLoading(false)}
  }
  return <section className="admin-panel kb-tester"><span className="kb-kicker">GEMINI ANSWER TEST</span><h2>Test this draft</h2>
    <p>Simulate a customer question using the current editor text, even if it has not been saved or published.</p>
    <form onSubmit={test}><div className="field"><label htmlFor="kb-test-lang">Customer language</label><select id="kb-test-lang" value={language} onChange={(e)=>setLanguage(e.target.value as 'en'|'id')}><option value="en">English</option><option value="id">Bahasa Indonesia</option></select></div>
      <div className="field"><label htmlFor="kb-test-question">Customer asks</label><textarea id="kb-test-question" rows={3} minLength={3} maxLength={600} required value={question} onChange={(e)=>setQuestion(e.target.value)}/></div>
      <button className="button" type="submit" disabled={loading}>{loading ? 'Generating reply…' : 'Preview AI answer'}</button>
    </form>
    {error ? <div className="kb-error" role="alert">{error}</div> : null}
    {answer ? <div className="kb-answer" aria-live="polite"><span>VORA Virtual Agent</span><p>{answer}</p></div> : null}
    <p className="kb-hint">This uses Gemini API quota. The test chat is not sent to a visitor or stored as a lead.</p>
  </section>
}

export function KnowledgeDelete({ id, revision }: {id:number;revision:number}) {
  return <form action={changeAgentKnowledgeStatus} onSubmit={(e) => {
    if (!window.confirm('Permanently delete this knowledge article and its revision history?')) e.preventDefault()
  }}><input type="hidden" name="record" value={id}/><input type="hidden" name="revision" value={revision}/><input type="hidden" name="operation" value="delete"/>
    <button className="kb-delete" type="submit" >Delete article permanently</button></form>
}
