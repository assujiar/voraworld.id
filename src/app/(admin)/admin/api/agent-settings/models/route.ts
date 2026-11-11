import { requireUser } from '@/server/auth/guard'
import { listProviderModels, validProvider } from '@/server/agent/providers'
import { errorResponse } from '@/server/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function GET(request: Request) {
  try {
    await requireUser(request)
    const provider = new URL(request.url).searchParams.get('provider')
    if (!validProvider(provider)) return Response.json({ error: 'Invalid provider' }, { status: 400 })
    const models = await listProviderModels(provider)
    return Response.json({ models }, { headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load models'
    if (/API key|Provider returned/.test(message)) return Response.json({ error: message }, { status: 400 })
    return errorResponse(error)
  }
}
