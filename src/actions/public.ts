'use server'
import { ActionError, publicRun, type Done } from '@/server/action'
import { isLocale, type Locale } from '@/content'
import { afterResponse } from '@/server/after'
import { createLead } from '@/server/leads'
import { dispatch } from '@/server/mail/outbox'
import { publicBaseUrl } from '@/server/env'
import { str } from '@/server/http'

async function submit(form: FormData, kind: 'contact' | 'rfq'): Promise<Done> {
  const l = String(form.get('locale') ?? 'en')
  const locale: Locale = isLocale(l) ? l : 'en'
  const page = `/${locale}/${kind === 'rfq' ? 'request-quote' : 'contact'}`
  // Honeypot: bots fill the hidden field. They are shown the success page and nothing is stored.
  if (str(form, 'website')) return { to: page, query: 'sent=1' }
  if (form.get('consent') !== 'yes') throw new ActionError('Consent required')
  await createLead({
    kind,
    name: str(form, 'name', 140), email: str(form, 'email', 200).toLowerCase(), phone: str(form, 'phone', 40), message: str(form, 'message', 6000), company: str(form, 'company', 200),
    mode: str(form, 'mode', 80), origin: str(form, 'origin', 160), destination: str(form, 'destination', 160), cargo: str(form, 'cargo', 6000), pickup: str(form, 'pickup', 30),
  })
  afterResponse(() => dispatch(publicBaseUrl(), 10))
  return { to: page, query: 'sent=1' }
}

export async function submitContact(form: FormData) {
  return publicRun(form, '/en/contact', ({ form }) => submit(form, 'contact'))
}

export async function submitQuote(form: FormData) {
  return publicRun(form, '/en/request-quote', ({ form }) => submit(form, 'rfq'))
}
