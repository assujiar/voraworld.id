import { notFound } from 'next/navigation'
import { AdminPage, type Notices } from '@/components/admin/AdminPage'
import { SigningCeremony } from '@/components/admin/SigningCeremony'
import { currentUser } from '@/server/auth/guard'
import { publicBaseUrl } from '@/server/env'
import { ActionError } from '@/server/errors'
import { routeId } from '@/server/http'
import { ceremonyView } from '@/server/trust/signing'

/** The signer's page: only the person the request names can open it (anyone else gets a refusal, whatever their role). */
export default async function SigningPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Notices> }) {
  const id = routeId((await params).id)
  const user = await currentUser()
  if (!id || !user) notFound()
  let view: Awaited<ReturnType<typeof ceremonyView>>
  try { view = await ceremonyView(user, id) } catch (e) {
    if (e instanceof ActionError) return <AdminPage heading="Signing" sp={await searchParams}><div className="admin-panel"><p className="alert" role="alert">{e.message}</p><p><a href="/admin/signers">Back</a></p></div></AdminPage>
    throw e
  }
  const verifyUrl = `${publicBaseUrl()}/verify/${view.verifyToken ?? 'preview'}`
  return (
    <AdminPage heading={`Sign ${view.doc.number}`} sp={await searchParams}>
      <SigningCeremony requestId={view.request.id} fileUrl={`/admin/signing/${view.request.id}/file`} verifyUrl={verifyUrl} lang={view.doc.language} signer={{ name: view.profile.displayName, position: view.profile.position }}
        reference={view.request.ref} purposeLabel={view.purposeLabel} signatureType={view.signatureType} sha256={view.artifact.sha256} version={view.artifact.version} number={view.doc.number} passkeys={view.passkeys} changed={view.changed} />
    </AdminPage>
  )
}
