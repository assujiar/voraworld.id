import type { Db } from './db'
import { sql } from './db'
import { PUBLIC_CONTACT_DEFAULTS } from './defaults'

/** Admin-managed settings override the shipped contact defaults. */
export async function settingMap(db: Db = sql): Promise<Record<string, string>> {
  const rows = await db`select key, value from settings`
  return { ...PUBLIC_CONTACT_DEFAULTS, ...Object.fromEntries(rows.map((r) => [r.key as string, r.value as string])) }
}

export async function saveSettings(db: Db, keys: string[], values: Record<string, string>): Promise<void> {
  for (const key of keys) {
    const value = String(values[key] ?? '').trim().slice(0, 12000)
    await db`insert into settings (key, value, updated_at) values (${key}, ${value}, now())
             on conflict (key) do update set value = excluded.value, updated_at = now()`
  }
}
