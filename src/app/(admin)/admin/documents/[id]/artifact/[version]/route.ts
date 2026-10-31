import { one } from '@/server/data'
import { requireUser } from '@/server/auth/guard'
import { ActionError } from '@/server/errors'
import { errorResponse, pdfResponse, routeId } from '@/server/http'
import { artifactsOf, readArtifact } from '@/server/trust/artifacts'

/** A recorded version of a document's file (1 is the issued file, later ones are signed files), for an administrator only: the archive is private and a QR token never opens it. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string; version: string }> }) {
  try {
    await requireUser(request)
    const { id: rawId, version: rawVersion } = await params
    const id = routeId(rawId), version = routeId(rawVersion)
    const doc = id ? await one('documents', (q) => q.eq('id', id), 'number') : undefined
    const artifact = doc ? (await artifactsOf('document', id)).find((a) => a.version === version) : undefined
    if (!doc || !artifact) throw new ActionError('Not found', 404)
    return pdfResponse(await readArtifact(artifact), `${doc.number}-v${version}.pdf`)
  } catch (e) { return errorResponse(e) }
}
