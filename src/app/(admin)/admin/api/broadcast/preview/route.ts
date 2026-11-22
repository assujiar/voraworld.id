import { assertSameOrigin } from '@/server/auth/csrf'
import { requireUser } from '@/server/auth/guard'
import { errorResponse } from '@/server/http'
import { renderBroadcast, BROADCAST_SAMPLE } from '@/server/broadcast/content'
import { publicBaseUrl } from '@/server/env'

export async function POST(request: Request) {
  try {
    assertSameOrigin(request.headers)
    await requireUser(request)
    const body=await request.json() as {subject?:unknown;html?:unknown}
    const subject=typeof body.subject==='string'?body.subject.slice(0,250):''
    const html=typeof body.html==='string'?body.html.slice(0,60_000):''
    const preview=renderBroadcast(subject || 'Email preview',html,BROADCAST_SAMPLE,`${publicBaseUrl()}/unsubscribe`)
    return Response.json(preview,{headers:{'cache-control':'no-store'}})
  } catch(e) {return errorResponse(e)}
}
