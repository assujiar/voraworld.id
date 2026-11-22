import { rpc } from '@/server/data'
import { publicRun } from '@/server/action'
import { ActionError } from '@/server/errors'
import { PendingForm } from '@/components/feedback/scope'
import { AsyncButton } from '@/components/feedback/AsyncButton'

const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)

async function unsubscribeAction(form: FormData) {
  'use server'
  return publicRun(form, '/unsubscribe', async ({ form }) => {
    const token = String(form.get('token') || '')
    if (!isUuid(token)) throw new ActionError('Invalid unsubscribe link')
    const done = await rpc<boolean>('broadcast_unsubscribe', { p_token: token })
    if (!done) throw new ActionError('This unsubscribe link is no longer valid')
    return { to: '/unsubscribe', query: 'done=1' }
  })
}

export default async function Unsubscribe({ searchParams }: { searchParams: Promise<{ token?: string; done?: string; error?: string }> }) {
  const q = await searchParams
  return (
    <main style={{ maxWidth: 600, margin: '8vh auto', padding: 24, fontFamily: 'Arial, sans-serif', lineHeight: 1.6 }}>
      <a href="/en">VORA</a><h1>Email preferences</h1>
      {q.done === '1' ? <p>Your address has been unsubscribed from VORA promotional emails.</p> : isUuid(q.token || '') ? <>
        <p>Stop receiving promotional and marketing emails from VORA. Transactional service emails are unaffected.</p>
        {q.error ? <p role="alert">{q.error}</p> : null}
        <PendingForm action={unsubscribeAction}>
          <input type="hidden" name="token" value={q.token} /><input type="hidden" name="_back" value={`/unsubscribe?token=${encodeURIComponent(q.token || '')}`} />
          <AsyncButton className="button">Unsubscribe</AsyncButton>
        </PendingForm>
      </> : <p>Invalid or expired link. Please use the unsubscribe link in a VORA email.</p>}
    </main>
  )
}
