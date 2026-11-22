import { AdminPage, Back, type Notices, fmt } from '@/components/admin/AdminPage'
import { count, many, slice, searchClause } from '@/server/data'
import { PendingForm } from '@/components/feedback/scope'
import { AsyncButton } from '@/components/feedback/AsyncButton'
import { saveBroadcastSettingsAction, importBroadcastCsvAction, dispatchBroadcastAction } from '@/actions/broadcast'

export default async function BroadcastHome({ searchParams }: { searchParams: Promise<Notices & {q?:string;page?:string}> }) {
  const sp=await searchParams
  const q=String(sp.q||'').trim().slice(0,100)
  const page=Math.min(9999,Math.max(1,Number.parseInt(sp.page||'1',10)||1))
  const clause=await searchClause(q,['company_name','pic_name','email','country','business_category'])
  const [setting,contactsTotal,eligible,totalCampaigns,campaigns,contacts]=await Promise.all([
    many('broadcast_settings',f=>f.eq('id',1),'enabled,max_per_hour',1),
    count('broadcast_contacts'),count('broadcast_contacts',f=>f.eq('consent_status','subscribed')),
    count('broadcast_campaigns'),
    many('broadcast_campaigns',f=>f.order('id',{ascending:false}),'id,name,subject,status,scheduled_at,created_at',30),
    slice('broadcast_contacts',f=>(clause?f.or(clause):f).order('id',{ascending:false}),'id,company_name,pic_name,email,business_category,tags,consent_status',((page-1)*75),75),
  ])
  const settings=setting[0]
  const qs=encodeURIComponent(q)
  return <AdminPage heading="Email Marketing & Broadcast" sp={sp} newHref="/admin/broadcast/new" newLabel="New campaign">
    <div className="broadcast-summary">
      <div className="admin-panel"><strong>{contactsTotal}</strong><span>Contacts</span></div>
      <div className="admin-panel"><strong>{eligible}</strong><span>Subscribed</span></div>
      <div className="admin-panel"><strong>{totalCampaigns}</strong><span>Campaigns</span></div>
      <div className="admin-panel"><strong>{Number(settings?.maxPerHour ?? 30)}/h</strong><span>Global send cap</span></div>
    </div>
    <div className="admin-panel"><h3>Campaigns</h3>
      <p className="mini muted">Campaigns use the subscribed contact list at launch. Promotional mail has its own delivery queue and rate limit.</p>
      <div className="broadcast-scroll"><table><thead><tr><th>Campaign</th><th>Status</th><th>Scheduled (WIB)</th><th>Created</th></tr></thead><tbody>
        {campaigns.length?campaigns.map(c=><tr key={c.id as number}><td><a href={`/admin/broadcast/${c.id}`}>{c.name as string}</a><br/><small>{c.subject as string}</small></td><td>{c.status as string}</td><td>{c.scheduledAt?fmt(new Date(c.scheduledAt as string)):''}</td><td>{fmt(new Date(c.createdAt as string))}</td></tr>):<tr><td colSpan={4}>No campaigns yet.</td></tr>}
      </tbody></table></div>
    </div>
    <div className="admin-panel"><div className="inline-actions"><h3>Contacts</h3><a className="button-outline" href="/admin/broadcast/contacts/new">+ Add contact</a></div>
      <p className="mini muted">Contacts are separate from customer/lead records. A contact needs documented opt-in evidence before it can receive promotional mail. Unverified contacts never enter the queue.</p>
      <form method="get" className="inline-actions"><input name="q" defaultValue={q} placeholder="Search company, PIC or email" aria-label="Search broadcast contacts"/><AsyncButton className="button-outline">Search</AsyncButton></form>
      <div className="broadcast-scroll"><table><thead><tr><th>Company</th><th>PIC</th><th>Email</th><th>Tags</th><th>Consent</th><th></th></tr></thead><tbody>
        {contacts.length?contacts.map(c=><tr key={c.id as number}><td>{c.companyName as string || '-'}</td><td>{c.picName as string || '-'}</td><td>{c.email as string}</td><td>{(c.tags as string[]).join(', ')}</td><td>{c.consentStatus as string}</td><td><a href={`/admin/broadcast/contacts/${c.id}`}>Edit</a></td></tr>):<tr><td colSpan={6}>No matching contacts.</td></tr>}
      </tbody></table></div>
      <div className="inline-actions" style={{marginTop:12}}>
        {page>1?<a className="button-outline" href={`?q=${qs}&page=${page-1}`}>Previous</a>:null}
        <span className="mini muted">Page {page}, up to 75 contacts per page</span>
        {contacts.length===75?<a className="button-outline" href={`?q=${qs}&page=${page+1}`}>Next</a>:null}
      </div>
      <details style={{marginTop:24}}><summary><strong>Import contacts (CSV)</strong></summary>
        <p className="mini muted">Excel can export CSV UTF-8. Required header: email. Optional headers: company_name, pic_name, position, phone, country, business_category, tags, source, consent_status, consent_evidence. Use comma-separated tags. Existing emails are skipped; no status is overwritten. Default consent status: unverified. Maximum 5,000 rows per file.</p>
        <a href="/static/downloads/vora-broadcast-contacts-template.csv" download>Download CSV template</a>
        <PendingForm action={importBroadcastCsvAction}><Back to="/admin/broadcast"/><div className="field"><label>CSV UTF-8 file</label><input name="csv" type="file" accept=".csv,text/csv" required/></div><AsyncButton className="button-outline">Import contacts</AsyncButton></PendingForm>
      </details>
    </div>
    <div className="admin-panel"><h3>Broadcast settings & dispatcher</h3>
      <p className="mini muted">The rate cap is enforced globally in the database over the previous rolling 60 minutes. SMTP must be enabled under <a href="/admin/mail">Email & Notifications</a>. An external scheduler must call the broadcast endpoint for automated delivery.</p>
      <PendingForm action={saveBroadcastSettingsAction}><Back to="/admin/broadcast"/>
        <div className="inline-actions"><div className="field"><label>Global limit / 60 min</label><input type="number" min={1} max={300} name="max_per_hour" defaultValue={settings?.maxPerHour as number ?? 30} required/></div>
          <label className="field" style={{alignSelf:'center'}}><span>Enable marketing delivery</span><input type="checkbox" name="enabled" defaultChecked={settings?.enabled as boolean ?? false}/></label></div>
        <AsyncButton className="button">Save settings</AsyncButton>
      </PendingForm>
      <PendingForm action={dispatchBroadcastAction} style={{marginTop:16}}><Back to="/admin/broadcast"/><AsyncButton className="button-outline">Process up to 5 queued emails now</AsyncButton></PendingForm>
    </div>
  </AdminPage>
}
