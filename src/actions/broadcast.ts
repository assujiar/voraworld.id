'use server'
import { revalidatePath } from 'next/cache'
import { adminRun } from '@/server/action'
import { ActionError, isUnique } from '@/server/errors'
import { one, insert, update, rpc } from '@/server/data'
import { emailAddress } from '@/server/mail/address'
import { cleanEmailHtml } from '@/server/mail/sanitize-email'
import { getMailConfig } from '@/server/mail/config'
import { send } from '@/server/mail/transport'
import { publicBaseUrl } from '@/server/env'
import { dispatchBroadcast } from '@/server/broadcast/dispatch'
import { CSV_FIELDS, parseCsv, renderBroadcast, emailSubject, BROADCAST_SAMPLE } from '@/server/broadcast/content'

const val = (f: FormData, key: string, max = 250) => String(f.get(key) ?? '').trim().slice(0, max)
const numId = (v: FormDataEntryValue | null) => {
  const n = Number(v)
  if (!Number.isSafeInteger(n) || n <= 0) throw new ActionError('Invalid record ID')
  return n
}
const tagList = (s: string) => [...new Set(s.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean))].slice(0, 30)
const broadcastHome = '/admin/broadcast'

export async function saveBroadcastContactAction(form: FormData) {
  return adminRun(form, async ({ form }) => {
    const id = val(form, 'id', 30)
    let email: string
    try { email = emailAddress(val(form, 'email', 254)).toLowerCase() }
    catch { throw new ActionError('Valid email address is required') }
    try {
      await rpc('broadcast_contact_save', { p: {
        ...(id ? { id: numId(id) } : {}), email,
        company_name: val(form,'company_name',240),pic_name:val(form,'pic_name',160),position:val(form,'position',160),
        phone:val(form,'phone',100),country:val(form,'country',100),business_category:val(form,'business_category',160),
        tags:tagList(val(form,'tags',600)),source:val(form,'source',240),consent_status:val(form,'consent_status',20),
        consent_evidence:val(form,'consent_evidence',2000),
      } })
    } catch(e) { if (isUnique(e)) throw new ActionError('This email already exists in Contacts'); throw e }
    revalidatePath(broadcastHome)
    return { to: broadcastHome, notice: 'Contact saved' }
  })
}

export async function importBroadcastCsvAction(form: FormData) {
  return adminRun(form, async ({ form }) => {
    const file = form.get('csv')
    if (!(file instanceof File) || file.size < 10 || file.size > 1_500_000) throw new ActionError('Choose a CSV under 1.5 MB')
    const rows = parseCsv(await file.text())
    if (rows.length < 2 || rows.length > 5001) throw new ActionError('CSV must have a header and 1–5000 contact rows')
    const headers = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g,'_'))
    if (new Set(headers).size !== headers.length || !headers.includes('email')) throw new ActionError('CSV must have one email column and no duplicate headers')
    const unknown = headers.filter((h) => !(CSV_FIELDS as readonly string[]).includes(h))
    if (unknown.length) throw new ActionError('Unsupported CSV columns: ' + unknown.join(', '))
    const records = rows.slice(1).map((r) => {
      if (r.length !== headers.length) return { email: '', invalid_csv_line: true }
      const o: Record<string, unknown> = Object.fromEntries(headers.map((key, index) => [key, r[index]?.trim() ?? '']))
      o.email = String(o.email ?? '').toLowerCase()
      o.tags = tagList(String(o.tags || ''))
      o.consent_status = String(o.consent_status || 'unverified').toLowerCase()
      return o
    })
    let added=0, duplicates=0, rejected=0
    const errs: string[] = []
    for (let i=0;i<records.length;i+=200) {
      const report = await rpc<{ inserted:number; duplicates:number; rejected:number; errors:Array<{email:string;error:string}> }>('broadcast_import_contacts',{ p_rows:records.slice(i,i+200) })
      added+=report.inserted;duplicates+=report.duplicates;rejected+=report.rejected
      for(const e of report.errors || []) if(errs.length<3) errs.push(`${e.email || 'row'}: ${e.error}`)
    }
    revalidatePath(broadcastHome)
    return { to:broadcastHome, notice:`Import: ${added} added, ${duplicates} duplicates, ${rejected} rejected${errs.length?' ('+errs.join('; ')+')':''}` }
  })
}

export async function saveBroadcastSettingsAction(form: FormData) {
  return adminRun(form, async ({ form }) => {
    const n = Number(form.get('max_per_hour'))
    if (!Number.isInteger(n) || n<1 || n>300) throw new ActionError('Hourly limit must be 1–300')
    await update('broadcast_settings',{ max_per_hour:n,enabled:form.get('enabled')==='on',updated_at:new Date() },q=>q.eq('id',1))
    revalidatePath(broadcastHome)
    return { to:broadcastHome,notice:'Broadcast settings saved' }
  })
}

export async function saveBroadcastCampaignAction(form: FormData) {
  return adminRun(form, async ({ form,user }) => {
    const id = val(form,'id',40)
    const name = val(form,'name',180)
    const subject = emailSubject(val(form,'subject',250))
    const html = cleanEmailHtml(String(form.get('html')||'').slice(0,60000))
    const audienceTag = val(form,'audience_tag',100).toLowerCase()
    if (!name || !subject || !html.trim()) throw new ActionError('Campaign name, subject and email HTML are required')
    if (!/<(?:p|div|table|h[1-4]|br|ul|ol|img|a|strong|b|span)\b/i.test(html)) throw new ActionError('Provide formatted HTML content')
    const when = val(form,'scheduled_at',40)
    let scheduledAt: Date | null = null
    if (when) {
      if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(when)) throw new ActionError('Invalid send date/time')
      scheduledAt = new Date(`${when}:00+07:00`)
      if (Number.isNaN(scheduledAt.getTime())) throw new ActionError('Invalid send date/time')
    }
    const row = { name,subject,html,audience_tag:audienceTag,scheduled_at:scheduledAt,updated_at:new Date() }
    let savedId: number
    if (id) {
      savedId=numId(id)
      const existing=await one('broadcast_campaigns',q=>q.eq('id',savedId),'status')
      if (!existing || existing.status!=='draft') throw new ActionError('Only draft campaigns can be edited')
      await update('broadcast_campaigns',row,q=>q.eq('id',savedId).eq('status','draft'))
    } else {
      const [created] = await insert('broadcast_campaigns',{...row,status:'draft',created_by:user.id})
      savedId=created.id as number
    }
    revalidatePath(broadcastHome)
    return {to:`${broadcastHome}/${savedId}`,notice:'Draft saved'}
  })
}

export async function launchBroadcastAction(form: FormData) {
  return adminRun(form, async ({ form }) => {
    const id=numId(form.get('id'))
    const n=await rpc<number>('broadcast_launch',{p_campaign:id})
    revalidatePath(broadcastHome)
    return {to:`${broadcastHome}/${id}`,notice:`Queued ${n} subscribed contacts. Delivery starts when the scheduler runs.`}
  })
}

export async function controlBroadcastAction(form: FormData) {
  return adminRun(form, async ({form})=>{
    const id=numId(form.get('id'))
    const action=val(form,'control',20)
    if (!['pause','resume','cancel'].includes(action)) throw new ActionError('Invalid control')
    await rpc('broadcast_campaign_control',{p_campaign:id,p_action:action})
    revalidatePath(broadcastHome)
    return {to:`${broadcastHome}/${id}`,notice:`Campaign ${action} requested`}
  })
}

export async function testBroadcastAction(form: FormData) {
  return adminRun(form, async ({form})=>{
    const id=numId(form.get('id'))
    const campaign=await one('broadcast_campaigns',q=>q.eq('id',id),'subject,html,status')
    if (!campaign || campaign.status!=='draft') throw new ActionError('Save a draft before sending a test')
    const conf=await getMailConfig()
    if (!conf?.enabled || !conf.adminEmail) throw new ActionError('Enable SMTP and set a notification admin email first')
    const rendered=renderBroadcast(campaign.subject as string,campaign.html as string,BROADCAST_SAMPLE,`${publicBaseUrl()}/unsubscribe`)
    await send(conf,conf.adminEmail,`[VORA TEST] ${rendered.subject}`,rendered.html)
    return {to:`${broadcastHome}/${id}`,notice:`Test email sent to ${conf.adminEmail}`}
  })
}

export async function dispatchBroadcastAction(form: FormData) {
  return adminRun(form,async()=>{
    const result=await dispatchBroadcast(5)
    revalidatePath(broadcastHome)
    return {to:broadcastHome,notice:`Dispatcher: ${result.sent} sent, ${result.failed} failed${result.reason?' ('+result.reason+')':''}`}
  })
}
