import { many, upsert } from './data'
import { COMPANY_DEFAULTS } from './defaults'

/** Admin-managed settings override the shipped contact defaults. */
export async function settingMap(): Promise<Record<string, string>> {
  const rows = await many('settings', (q) => q, 'key,value')
  return { ...COMPANY_DEFAULTS, ...Object.fromEntries(rows.map((r) => [r.key as string, r.value as string])) }
}

export async function saveSettings(keys: string[], values: Record<string, string>): Promise<void> {
  if (!keys.length) return
  await upsert('settings', keys.map((key) => ({ key, value: String(values[key] ?? '').trim().slice(0, 12000), updated_at: new Date() })), 'key')
}
