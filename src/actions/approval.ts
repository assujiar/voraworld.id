'use server'
import { publicRun } from '@/server/action'
import { maxUploadBytes } from '@/server/env'
import { submitApproval } from '@/server/finance/quotations'
import { fileBytes, str } from '@/server/http'

const TOKEN = /^[A-Za-z0-9_-]{36,150}$/

/** The customer's upload of the signed, stamped quotation. It is a submission for review, never an approval. */
export async function submitApprovalAction(form: FormData) {
  const token = TOKEN.test(str(form, 'token', 160)) ? str(form, 'token', 160) : ''
  return publicRun(form, token ? `/quotation-approval/${token}` : '/en', async ({ form }) => {
    await submitApproval({
      token, signerName: str(form, 'signer_name', 180), signerTitle: str(form, 'signer_title', 180), acknowledged: form.get('ack') === 'yes',
      file: await fileBytes(form, 'signed_pdf', maxUploadBytes()),
    })
    return { to: `/quotation-approval/${token}`, query: 'received=1' }
  })
}
