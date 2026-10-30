import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { isProd, supabaseUrl } from '@/server/env'
import { localRoot } from '@/server/storage'

export const dynamic = 'force-dynamic'
const TYPES: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif' }

/** Serves images uploaded while no Supabase storage is configured (local development). Never active in production. */
export async function GET(_req: Request, ctx: { params: Promise<{ key: string[] }> }) {
  const key = (await ctx.params).key.join('/')
  const ext = key.slice(key.lastIndexOf('.')).toLowerCase()
  if (isProd() || supabaseUrl() || !/^[A-Za-z0-9_-]+\.[a-z0-9]+$/.test(key) || !TYPES[ext]) return new Response('Not found', { status: 404 })
  try {
    const bytes = await readFile(join(localRoot(), 'media', key))
    return new Response(bytes, { headers: { 'content-type': TYPES[ext], 'x-content-type-options': 'nosniff', 'cache-control': 'public, max-age=3600' } })
  } catch {
    return new Response('Not found', { status: 404 })
  }
}
