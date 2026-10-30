import { supabaseForRequest } from '@/server/supabase/clients'

/** Where an emailed Supabase link lands (password reset): the one-time `code` is exchanged for a session, then the person goes on. */
const safeNext = (v: string | null) => (v && /^\/admin(?:[/?][^\s\\]*)?$/.test(v) && !v.includes('..') && !v.includes('//') ? v : '/admin')

/** A redirect to a path on the address the person is already using (no origin to guess, so a preview or www address stays as it is). */
const go = (path: string) => new Response(null, { status: 303, headers: { Location: path, 'Cache-Control': 'no-store' } })

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const expired = () => go('/admin/login?error=' + encodeURIComponent('This link has expired or was already used. Request a new one.'))
  if (!code || code.length > 200) return expired()
  const supabase = await supabaseForRequest()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) return expired()
  return go(safeNext(url.searchParams.get('next')))
}
