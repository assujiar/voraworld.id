import { notFound } from 'next/navigation'
import { AdminPage, Back, fmt, type Notices } from '@/components/admin/AdminPage'
import { count, many, one } from '@/server/data'
import { PendingForm } from '@/components/feedback/scope'
import { AsyncButton } from '@/components/feedback/AsyncButton'
import { BroadcastEditor } from '@/components/admin/BroadcastEditor'
import { saveBroadcastCampaignAction, launchBroadcastAction, controlBroadcastAction, testBroadcastAction } from '@/actions/broadcast'

const initial='<div style="font-family:Arial;font-size:15px;color:#1b2430"><h2>Dear {{pic_name}},</h2><p>We would like to introduce VORA freight forwarding and logistics services.</p><p>Learn more at <a href="https://voraworld.id">voraworld.id</a>.</p><p>Best regards,<br>VORA Team</p></div>'
const wib=(d:Date|string|undefined)=>{
  if(!d) return ''
  const date=new Date(d)
  const pieces = new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(date)
  return pieces.replace(' ','T')
}

export default async function CampaignPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Notices>}) {
  const {id}=await params
  const fresh=id==='new'
  if(!fresh && (!/^\d+$/.test(id)||Number(id)<=0)) notFound()
  const c=fresh?undefined:await one('broadcast_campaigns',q=>q.eq('id',Number(id)))
  if(!fresh&&!c) notFound()
  const status=String(c?.status||'draft')
  const edit=status==='draft'
  const counts=c?await Promise.all(['queued','sending','retry','sent','failed','skipped','cancelled'].map(async s=>({status:s,n:await count('broadcast_deliveries',q=>q.eq('campaign_id',Number(id)).eq('status',s))}))):[]
  const rows=c?await many('broadcast_deliveries',q=>q.eq('campaign_id',Number(id)).order('id',{ascending:false}), 'recipient_email,status,attempts,sent_at,last_error',100):[]
  return <AdminPage heading={fresh?'New email campaign':String(c?.name)} sp={await searchParams}>
    <div className="admin-panel"><div className="inline-actions"><a className="button-outline" href="/admin/broadcast">Back to Broadcast</a><span className="status">{status}</span></div>
      {edit?<PendingForm action={saveBroadcastCampaignAction}>
        <Back to={fresh?'/admin/broadcast/new':`/admin/broadcast/${id}`}/><input name="id" type="hidden" value={fresh?'':id}/>
        <div className="admin-form-grid"><div className="field"><label>Internal campaign name *</label><input name="name" required maxLength={180} defaultValue={c?.name as string||''}/></div>
          <div className="field"><label>Audience tag (blank = all subscribed contacts)</label><input name="audience_tag" maxLength={100} defaultValue={c?.audienceTag as string||''} placeholder="e.g. freight-forwarders"/></div>
          <div className="field"><label>Schedule (WIB, blank = next dispatcher run)</label><input name="scheduled_at" type="datetime-local" defaultValue={wib(c?.scheduledAt as Date)}/></div>
        </div>
        <BroadcastEditor initialHtml={c?.html as string||initial} initialSubject={c?.subject as string||'VORA | Freight & Logistics Solutions'}/>
        <AsyncButton className="button">Save draft</AsyncButton>
      </PendingForm>:<><p><strong>Email subject:</strong> {c?.subject as string}</p><p className="mini muted">Audience: {c?.audienceTag as string||'All subscribed contacts'} · Scheduled: {c?.scheduledAt?fmt(new Date(c.scheduledAt as string)): 'Next dispatcher run'}</p></>}
    </div>
    {c?<div className="admin-panel"><h3>Campaign actions</h3>
      <div className="inline-actions">
        {edit?<><PendingForm action={testBroadcastAction}><Back to={`/admin/broadcast/${id}`}/><input type="hidden" name="id" value={id}/><AsyncButton className="button-outline">Send test to admin email</AsyncButton></PendingForm>
          <PendingForm action={launchBroadcastAction}><Back to={`/admin/broadcast/${id}`}/><input type="hidden" name="id" value={id}/><AsyncButton className="button" confirm={{title:"Launch campaign",body:"Queue this campaign for all subscribed contacts matching the selected audience?",action:"Launch"}}>Launch campaign</AsyncButton></PendingForm></>:null}
        {(['queued','running'].includes(status))?<PendingForm action={controlBroadcastAction}><Back to={`/admin/broadcast/${id}`}/><input type="hidden" name="id" value={id}/><input type="hidden" name="control" value="pause"/><AsyncButton className="button-outline">Pause campaign</AsyncButton></PendingForm>:null}
        {status==='paused'?<PendingForm action={controlBroadcastAction}><Back to={`/admin/broadcast/${id}`}/><input type="hidden" name="id" value={id}/><input type="hidden" name="control" value="resume"/><AsyncButton className="button">Resume</AsyncButton></PendingForm>:null}
        {['queued','running','paused'].includes(status)?<PendingForm action={controlBroadcastAction}><Back to={`/admin/broadcast/${id}`}/><input type="hidden" name="id" value={id}/><input type="hidden" name="control" value="cancel"/><AsyncButton className="button-outline" confirm={{title:"Cancel campaign",body:"Cancel pending deliveries? In-flight SMTP sends may still complete.",action:"Cancel",danger:true}}>Cancel pending</AsyncButton></PendingForm>:null}
      </div>
      <p className="mini muted">A send in progress cannot be withdrawn. Failures that may have reached SMTP but were not acknowledged are held for manual review to avoid automatic duplicate sends.</p>
    </div>:null}
    {c && status!=='draft'?<div className="admin-panel"><h3>Delivery report</h3>
      <div className="broadcast-metrics">{counts.map(item=><div key={item.status}><strong>{item.n}</strong><span>{item.status}</span></div>)}</div>
      <div className="broadcast-scroll"><table><thead><tr><th>Recipient</th><th>Status</th><th>Attempts</th><th>Sent at (WIB)</th><th>Details</th></tr></thead><tbody>
        {rows.map(r=><tr key={r.recipientEmail as string}><td>{r.recipientEmail as string}</td><td>{r.status as string}</td><td>{r.attempts as number}</td><td>{r.sentAt?fmt(new Date(r.sentAt as string)):'-'}</td><td>{String(r.lastError||'').slice(0,160)}</td></tr>)}
      </tbody></table></div><p className="mini muted">Shows the latest 100 delivery records. Totals above cover the entire campaign.</p>
    </div>:null}
  </AdminPage>
}
