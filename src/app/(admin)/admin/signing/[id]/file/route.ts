import { requireUser } from '@/server/auth/guard'
import { errorResponse, pdfResponse, routeId } from '@/server/http'
import { ActionError } from '@/server/errors'
import { ceremonyFile } from '@/server/trust/signing'

/** The exact file the signer is asked to sign, for the signer only (it is the archived artifact, its SHA-256 re-checked). A QR token or another administrator cannot fetch it here. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request)
    const id = routeId((await params).id)
    if (!id) throw new ActionError('Not found', 404)
    const f = await ceremonyFile(user, id)
    return pdfResponse(f.bytes, f.filename)
  } catch (e) { return errorResponse(e) }
}
