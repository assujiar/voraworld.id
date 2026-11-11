'use server'
import { adminRun, ActionError } from '@/server/action'
import { one, rpc, update } from '@/server/data'
import { recordAudit } from '@/server/audit'
import { validModel, validProvider } from '@/server/agent/providers'

export async function saveAgentSettings(form: FormData) {
  return adminRun(form, async ({ user }) => {
    const provider = form.get('provider')
    const model = form.get('model')
    const enabled = form.get('enabled') === 'on'
    const newKey = String(form.get('api_key') || '').trim()
    if (!validProvider(provider) || !validModel(provider, model)) throw new ActionError('Choose a valid provider and model')
    if (newKey && (newKey.length < 15 || newKey.length > 400 || /\s/.test(newKey))) throw new ActionError('Invalid API key format')
    if (newKey) await rpc('agent_ai_set_key', { p_provider: provider, p_key: newKey, p_actor: user.id })
    const credential = await one('agent_ai_credentials', (q) => q.eq('provider', provider), 'provider')
    if (enabled && !credential) throw new ActionError('Save an API key for this provider before enabling the agent')
    await update('agent_ai_config', { provider, model, enabled, updated_by: user.id, updated_at: new Date() }, (q) => q.eq('id', 1))
    // Never store keys in audit logs or action results.
    await recordAudit(user.id, 'update', 'agent_ai_config', 1, `AI provider ${provider}, model ${model}, ${enabled ? 'enabled' : 'disabled'}${newKey ? ', API key replaced' : ''}`)
    return { to: '/admin/agent-settings', notice: 'Agent configuration saved. Changes take effect on the next request.' }
  })
}

export async function removeAgentProviderKey(form: FormData) {
  return adminRun(form, async ({ user }) => {
    const provider = form.get('provider')
    if (!validProvider(provider)) throw new ActionError('Invalid provider')
    await rpc('agent_ai_remove_key', { p_provider: provider })
    await recordAudit(user.id, 'delete', 'agent_ai_credentials', 1, `Removed ${provider} API key`)
    return { to: '/admin/agent-settings', notice: `${provider} API key removed. If active, the agent was disabled.` }
  })
}
