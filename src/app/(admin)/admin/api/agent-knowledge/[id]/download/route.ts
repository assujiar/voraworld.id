import { requireUser } from '@/server/auth/guard'
import { one } from '@/server/data'
import { getObject } from '@/server/storage'
import { routeId, errorResponse } from '@/server/http'
import { HttpError } from '@/server/http'
import { AGENT_FILE_MAX_BYTES } from '@/server/agent/document-import'

export const runtime = 'nodejs'
export async function GET(request: Request, { params }: { params: Promise<{id:string}> }) {
  try {
    await requireUser(request)
    const id = routeId((await params).id)
    const doc = id ? await one('agent_knowledge', (q)=>q.eq('id',id), 'attachment_key,attachment_name') : undefined
    if (!doc?.attachmentKey || !doc?.attachmentName) throw new HttpError(404,'Attachment not found')
    const filename = String(doc.attachmentName).replace(/[\\/:*?"<>|\u0000-\u001f]/g,' ').slice(0,200)
    const bytes = await getObject('documents',String(doc.attachmentKey),AGENT_FILE_MAX_BYTES)
    const mime = filename.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    return new Response(Buffer.from(bytes), { headers: {
      'content-type':mime,'content-disposition':`attachment; filename="${filename.replace(/[^\x20-\x7e]/g,'_')}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'cache-control':'private,no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer',
    } })
  } catch (e) { return errorResponse(e) }
}
