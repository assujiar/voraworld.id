import { notFound } from 'next/navigation'
import { AdminPage, Back, type Notices } from '@/components/admin/AdminPage'
import { one } from '@/server/data'
import { PendingForm } from '@/components/feedback/scope'
import { AsyncButton } from '@/components/feedback/AsyncButton'
import { saveBroadcastContactAction } from '@/actions/broadcast'

export default async function ContactEdit({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Notices>}) {
  const {id}=await params
  const fresh=id==='new'
  if(!fresh && (!/^\d+$/.test(id)||Number(id)<=0)) notFound()
  const c=fresh?undefined:await one('broadcast_contacts',q=>q.eq('id',Number(id)))
  if(!fresh && !c) notFound()
  const field=(name:string, label:string, max=240)=> <div className="field"><label htmlFor={'contact-'+name}>{label}</label><input id={'contact-'+name} name={name} maxLength={max} defaultValue={String(c?.[name.replace(/_([a-z])/g,(_,a:string)=>a.toUpperCase())]||'')}/></div>
  return <AdminPage heading={fresh?'Add broadcast contact':'Edit broadcast contact'} sp={await searchParams}>
    <div className="admin-panel"><p className="mini muted">Adding a contact does not authorise marketing emails. Set subscribed only with documented evidence. Previously unsubscribed contacts require new consent evidence before re-subscription.</p>
      <PendingForm action={saveBroadcastContactAction}><Back to={fresh?'/admin/broadcast/contacts/new':`/admin/broadcast/contacts/${id}`}/><input type="hidden" name="id" value={fresh?'':id}/>
        <div className="admin-form-grid">
          {field('company_name','Company name')}{field('pic_name','PIC name')}{field('position','PIC position')}
          <div className="field"><label htmlFor="contact-email">Email *</label><input id="contact-email" type="email" name="email" maxLength={254} defaultValue={c?.email as string||''} required/></div>
          {field('phone','Phone / WhatsApp',100)}{field('country','Country',100)}{field('business_category','Business category',160)}
          <div className="field"><label htmlFor="contact-tags">Tags (comma-separated)</label><input id="contact-tags" name="tags" defaultValue={(c?.tags as string[]||[]).join(', ')}/></div>
          {field('source','Source of contact')}
          <div className="field"><label htmlFor="contact-consent">Marketing consent *</label><select id="contact-consent" name="consent_status" defaultValue={c?.consentStatus as string||'unverified'}>
            <option value="unverified">Unverified, do not send</option><option value="subscribed">Subscribed, evidence recorded</option><option value="unsubscribed">Unsubscribed, do not send</option>
          </select></div>
          <div className="field wide"><label htmlFor="contact-evidence">Consent evidence / basis (required when subscribed)</label><textarea id="contact-evidence" name="consent_evidence" rows={3} defaultValue={c?.consentEvidence as string||''} placeholder="When, how and from whom opt-in was obtained; reference to consent record"/></div>
        </div><div className="inline-actions"><AsyncButton className="button">Save contact</AsyncButton><a className="button-outline" href="/admin/broadcast">Back to Broadcast</a></div>
      </PendingForm>
    </div>
  </AdminPage>
}
