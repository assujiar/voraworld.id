'use client'
import { useState } from 'react'
import { PendingForm } from '@/components/feedback/scope'
import { AsyncButton } from '@/components/feedback/AsyncButton'
import { saveAgentSettings, removeAgentProviderKey } from '@/actions/agent-settings'
import { RECOMMENDED_MODELS, type AIProvider } from '@/lib/agent-models'

interface Initial { provider: AIProvider; model: string; enabled: boolean; keys: Record<string,string> }

export function AgentSettingsPanel({ initial }: { initial: Initial }) {
  const [provider, setProvider] = useState<AIProvider>(initial.provider)
  const [model, setModel] = useState(initial.model)
  const [enabled, setEnabled] = useState(initial.enabled)
  const [liveModels, setLiveModels] = useState<Record<string, Array<{id:string;label:string}>>>({})
  const [busy, setBusy] = useState(false)
  const [testing, setTesting] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const configured = Boolean(initial.keys[provider])
  const suggested = RECOMMENDED_MODELS[provider]
  const choices = [...suggested, ...(liveModels[provider] || []).filter((candidate) => !suggested.some((m) => m.id === candidate.id))]
  if (!choices.some((m) => m.id === model)) choices.unshift({ id: model, label: `${model} (current)` })

  async function discover() {
    setBusy(true); setError(''); setStatus('')
    try {
      const response = await fetch(`/admin/api/agent-settings/models?provider=${provider}`, { credentials: 'same-origin' })
      const result = await response.json() as { models?: Array<{id:string;label:string}>; error?: string }
      if (!response.ok) throw new Error(result.error || 'Could not fetch models')
      setLiveModels((prev) => ({...prev, [provider]: result.models || []}))
      setStatus(`${result.models?.length || 0} compatible models found for the saved ${provider} API key.`)
    } catch (e) { setError(e instanceof Error ? e.message : 'Model discovery failed') }
    finally { setBusy(false) }
  }

  async function test() {
    setTesting(true); setStatus(''); setError('')
    try {
      const r = await fetch('/admin/api/agent-settings/test', { method: 'POST', credentials: 'same-origin', headers: {'content-type':'application/json'}, body: JSON.stringify({provider,model}) })
      const result = await r.json() as { message?: string; error?: string }
      if (!r.ok) throw new Error(result.error || 'Connection failed')
      setStatus(result.message || 'Connection successful')
    } catch (e) { setError(e instanceof Error ? e.message : 'Connection failed') }
    finally { setTesting(false) }
  }

  return <div className="agent-settings-shell">
    <div className="agent-settings-intro"><div className="agent-settings-symbol">AI</div><div><h2>Model & provider</h2><p>Manage provider access and model selection here. API keys are encrypted in Supabase Vault and never displayed again.</p></div></div>
    <div className="agent-settings-grid"><section className="admin-panel agent-settings-main">
      <PendingForm action={saveAgentSettings}>
        <input type="hidden" name="_back" value="/admin/agent-settings"/>
        <div className="agent-settings-section"><h3>1. Provider</h3><p>Select which AI service answers conversations on voraworld.id.</p>
          <div className="agent-settings-provider-grid">
            {(['gemini','openai'] as const).map((item) => <label key={item} className={`agent-settings-provider ${provider === item ? 'is-selected' : ''}`}>
              <input type="radio" name="provider" value={item} checked={provider===item} onChange={()=>{setProvider(item);setModel(RECOMMENDED_MODELS[item][0].id);setStatus('');setError('')}}/>
              <span className="agent-settings-provider-title">{item === 'gemini' ? 'Google Gemini' : 'OpenAI GPT'}</span>
              <span className="agent-settings-muted">{item === 'gemini' ? 'Free tier may be available, subject to model and account limits.' : 'API usage is generally billable. Check your OpenAI billing.'}</span>
              <span className="agent-settings-provider-key">{initial.keys[item] ? `Saved key ····${initial.keys[item]}` : 'No API key saved'}</span>
            </label>)}
          </div>
        </div>
        <div className="agent-settings-section"><h3>2. API key</h3><p>{configured ? 'Leave blank to retain the existing key. Paste a new one to replace it.' : 'Paste the API key from your provider dashboard.'}</p>
          <label className="field"><span>{provider === 'gemini' ? 'Gemini API key' : 'OpenAI API key'}</span><input name="api_key" type="password" autoComplete="new-password" placeholder={configured ? 'Leave blank to keep existing key' : 'Paste API key'} minLength={15} maxLength={400}/></label>
          <span className="agent-settings-muted">The key is submitted directly to the VORA backend over HTTPS, never stored in JavaScript or exposed to visitors.</span>
        </div>
        <div className="agent-settings-section"><h3>3. Model</h3><p>Choose a suggested model, or load the exact models enabled for your saved API key.</p>
          <div className="agent-settings-model-row"><label className="field"><span>Model version</span><select name="model" value={model} onChange={(e)=>setModel(e.target.value)}>{choices.map((m)=><option value={m.id} key={m.id}>{m.label} ({m.id})</option>)}</select></label>
            <button className="button-outline" disabled={!configured || busy} type="button" onClick={()=>void discover()}>{busy ? 'Checking…' : 'Fetch available models'}</button></div>
          <span className="agent-settings-muted">Available models, free quotas and billing can change. A listed model is not a guarantee of free access.</span>
        </div>
        <div className="agent-settings-section"><h3>4. Activation</h3><label className="agent-settings-toggle"><input type="checkbox" name="enabled" checked={enabled} onChange={(e)=>setEnabled(e.target.checked)}/><span><strong>Enable VORA Virtual Agent</strong><small>The chat launcher is shown only while this setting is enabled and the selected provider has a working key.</small></span></label></div>
        {provider === 'openai' && <div className="agent-settings-warning">OpenAI API requests may incur charges. Activating this provider uses your own OpenAI billing account; VORA does not silently fall back to a paid model.</div>}
        <div className="agent-settings-actions"><AsyncButton type="submit" className="button">Save AI configuration</AsyncButton><button className="button-outline" type="button" onClick={()=>void test()} disabled={!configured||testing}>{testing ? 'Testing…' : 'Test saved key & model'}</button></div>
      </PendingForm>
      {(status || error) && <p role="status" className={error ? 'kb-error' : 'agent-settings-success'}>{error || status}</p>}
    </section>
    <aside className="agent-settings-aside"><section className="admin-panel"><span className="kb-kicker">SECURITY</span><h3>Credentials</h3><p>Keys are encrypted using Supabase Vault. This page only shows whether a key is stored and its last four characters.</p>
      {(['gemini','openai'] as const).map((item) => <div className="agent-settings-credential" key={item}><span><strong>{item === 'gemini' ? 'Gemini' : 'OpenAI'}</strong><small>{initial.keys[item] ? `Configured · ····${initial.keys[item]}` : 'Not configured'}</small></span>
        {initial.keys[item] && <PendingForm action={removeAgentProviderKey}><input type="hidden" name="provider" value={item}/><input type="hidden" name="_back" value="/admin/agent-settings"/><AsyncButton className="button-outline" type="submit">Remove</AsyncButton></PendingForm>}</div>)}
    </section><section className="admin-panel"><span className="kb-kicker">RESPONSE POLICY</span><h3>Natural answers, no citations</h3><p>The agent uses published Knowledge Base articles to inform responses. Internal sources remain available to admins but are never presented as reference lists to visitors.</p><p>Rates, availability, customs classification, permits and DG acceptance must still be verified for specific shipments.</p><a className="button-outline" href="/admin/agent-knowledge">Open Knowledge Base</a></section></aside></div>
  </div>
}
