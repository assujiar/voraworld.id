import { AdminPage, type Notices } from '@/components/admin/AdminPage'
import { one, many } from '@/server/data'
import { AgentSettingsPanel } from '@/components/admin/AgentSettingsPanel'

export default async function AgentSettingsPage({ searchParams }: { searchParams: Promise<Notices> }) {
  const [config, credentials] = await Promise.all([
    one('agent_ai_config', (q) => q.eq('id', 1), 'provider,model,enabled,updated_at'),
    many('agent_ai_credentials', (q) => q, 'provider,key_hint,updated_at', 2),
  ])
  return <AdminPage heading="VORA Virtual Agent · AI Settings" sp={await searchParams}>
    <AgentSettingsPanel initial={{
      provider: config?.provider === 'openai' ? 'openai' : 'gemini',
      model: String(config?.model || 'gemini-3.5-flash-lite'),
      enabled: Boolean(config?.enabled),
      keys: Object.fromEntries(credentials.map((c) => [String(c.provider), String(c.keyHint || '')])),
    }}/>
  </AdminPage>
}
