"""VORA corporate website and business admin. FastAPI / SQLAlchemy, portable to Vercel + Supabase Postgres."""
from __future__ import annotations
import os, csv, io, json, re, secrets, hashlib, hmac, time, mimetypes, urllib.request
from pathlib import Path
from datetime import date, datetime, timedelta, timezone
from typing import Optional
from urllib.parse import quote
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Response, UploadFile, File, Form, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse, PlainTextResponse, StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy import select, or_, func
from sqlalchemy.exc import IntegrityError
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from .db import (init_db, Session, User, Setting, Page, Section, Revision, Article, Faq,
 ServiceCoverage, Media, Lead, LeadActivity, Customer, BankAccount, InvoiceBankInstruction, Quotation, QuotationItem, Invoice, InvoiceItem, Payment, Receipt, QuotationApproval,
 Verification, Audit, Redirect, Nav, now)
from .logic import (clean_html, slugify, units, money, calc_lines, ensure_public_code, next_number, create_verification,
 get_verification, record_audit, recompute_outstanding, payment_record, pdf_document)
from .content import SERVICES, TEXT, NAV, SERVICE_GROUPS, SERVICE_MODES, SERVICE_ALIASES
from .defaults import PUBLIC_CONTACT_DEFAULTS

ROOT=Path(__file__).resolve().parent
IS_PROD=os.getenv('APP_ENV','development')=='production'
if IS_PROD and not os.getenv('DATABASE_URL','').startswith(('postgresql://','postgres://','postgresql+psycopg://')):
 raise RuntimeError('Production requires persistent PostgreSQL DATABASE_URL')
if IS_PROD and not os.getenv('PUBLIC_BASE_URL','').startswith('https://'):
 raise RuntimeError('Production requires HTTPS PUBLIC_BASE_URL for document verification QR codes')
SECRET=os.getenv('SESSION_SECRET','')
if IS_PROD and (len(SECRET)<32 or SECRET.startswith('replace-')):
 raise RuntimeError('SESSION_SECRET must contain >=32 random characters in production')
if not SECRET:SECRET='local-development-not-for-production-only'
serializer=URLSafeTimedSerializer(SECRET,salt='vora-auth-v1')
csrf_serializer=URLSafeTimedSerializer(SECRET,salt='vora-csrf-v1')

@asynccontextmanager
async def lifespan(app):
 # Production schema must be migrated before deploy; create_all only in development.
 if not IS_PROD:init_db()
 yield
app=FastAPI(title='VORA Corporate CMS',docs_url=None if IS_PROD else '/api/docs',redoc_url=None,openapi_url=None if IS_PROD else '/api/openapi.json',lifespan=lifespan)
app.mount('/static',StaticFiles(directory=str(ROOT/'static')),name='static')
if not IS_PROD:
 uploads=ROOT.parent/'uploads';uploads.mkdir(exist_ok=True)
 app.mount('/uploads',StaticFiles(directory=str(uploads)),name='uploads')
templates=Jinja2Templates(directory=str(ROOT/'templates'))

@app.middleware('http')
async def headers(req:Request,call_next):
 resp=await call_next(req)
 resp.headers['X-Content-Type-Options']='nosniff'
 resp.headers['Referrer-Policy']='strict-origin-when-cross-origin'
 resp.headers['X-Frame-Options']='DENY'
 resp.headers['Permissions-Policy']='camera=(), microphone=(), geolocation=()'
 if req.url.path.startswith(('/admin','/verify','/quotation-approval')):
  resp.headers['X-Robots-Tag']='noindex, nofollow'
 if IS_PROD:resp.headers['Strict-Transport-Security']='max-age=31536000; includeSubDomains'
 return resp

class UserError(Exception):pass

def password_hash(pw):
 salt=secrets.token_bytes(32);digest=hashlib.pbkdf2_hmac('sha256',pw.encode(),salt,310_000)
 return 'pbkdf2_sha256$310000$'+salt.hex()+'$'+digest.hex()

def password_valid(pw,encoded):
 try:
  scheme,iterations,salt,expected=encoded.split('$')
  return scheme=='pbkdf2_sha256' and hmac.compare_digest(hashlib.pbkdf2_hmac('sha256',pw.encode(),bytes.fromhex(salt),int(iterations)),bytes.fromhex(expected))
 except (ValueError,TypeError):return False

def current_user(req,db):
 token=req.cookies.get('vora_session')
 if not token:return None
 try:payload=serializer.loads(token,max_age=60*60*8)
 except (BadSignature,SignatureExpired):return None
 u=db.get(User,payload.get('id'))
 return u if u and u.active else None

ROLES={'superadmin':{'*'},'admin':{'content','crm','finance','settings'},'editor':{'content'},'sales':{'crm'},'finance':{'finance'},'viewer':set()}
def auth(req,db,permission=None):
 u=current_user(req,db)
 if not u:raise HTTPException(status_code=401,detail='Authentication required')
 if permission and '*' not in ROLES.get(u.role,set()) and permission not in ROLES.get(u.role,set()):
  raise HTTPException(status_code=403,detail='Permission denied')
 return u

def csrf_make():return csrf_serializer.dumps(secrets.token_urlsafe(24))
def csrf_valid(req,form):
 cookie=req.cookies.get('vora_csrf','');incoming=str(form.get('csrf',''))
 if not cookie or not incoming or not secrets.compare_digest(cookie,incoming):raise HTTPException(403,'Invalid CSRF token')
 try:csrf_serializer.loads(cookie,max_age=60*60*12)
 except (BadSignature,SignatureExpired):raise HTTPException(403,'Expired CSRF token')

def html(req,template,context={},code=200):
 ctx={'request':req,**context}
 if not req.cookies.get('vora_csrf'):
  token=csrf_make();ctx['csrf']=token
  resp=templates.TemplateResponse(req,template,ctx,status_code=code)
  resp.set_cookie('vora_csrf',token,secure=IS_PROD,httponly=True,samesite='lax',max_age=60*60*12,path='/')
  return resp
 ctx['csrf']=req.cookies['vora_csrf']
 return templates.TemplateResponse(req,template,ctx,status_code=code)

def see_also(req,where='/admin',msg=''):
 dest=where+('?' if '?' not in where else '&')+('notice='+quote(msg) if msg else 'saved=1')
 return RedirectResponse(dest,status_code=303)

def setting_map(db):
 # Admin-managed persistent settings override first-install contact details.
 return {**PUBLIC_CONTACT_DEFAULTS, **{s.key:s.value for s in db.query(Setting).all()}}
def settings_update(db,keys,form,actor):
 for k in keys:
  v=str(form.get(k,'')).strip()[:12000];o=db.get(Setting,k)
  if o:o.value=v
  else:db.add(Setting(key=k,value=v))
 record_audit(db,actor.id,'publish','settings',0,','.join(keys));db.commit()

def base_url(req):return os.getenv('PUBLIC_BASE_URL',str(req.base_url).rstrip('/')).rstrip('/')
def clean_path(value):
 if not value.startswith('/') or value.startswith('//') or '\\' in value or '://' in value:raise UserError('Invalid relative path')
 return value

def is_admin_navigation(value):
 """Keep internal paths out of public navigation, including legacy CMS entries."""
 path=str(value).strip().lower().split('?',1)[0].split('#',1)[0]
 return re.match(r'^/(?:en/|id/)?admin(?:/|$)',path) is not None

def snapshot_page(db,p):
 sections=db.query(Section).filter_by(page_id=p.id).order_by(Section.position,Section.id).all()
 return dict(title=p.title,slug=p.slug,description=p.description,seo_title=p.seo_title,seo_description=p.seo_description,locale=p.locale,sections=[{k:getattr(s,k) for k in ('position','kind','layout','visible','title','body','image','button_label','button_href','surface')} for s in sections])

def public_payload(req,db,locale,path,kind,**items):
 values=TEXT[locale]
 settings=setting_map(db)
 nav=db.query(Nav).filter_by(location='header',visible=True).order_by(Nav.position).all()
 valid_links=[(n.label,n.href) for n in nav if not is_admin_navigation(n.href)]
 links=valid_links or [(label,href) for label,href in NAV if not is_admin_navigation(href)]
 articles=items.pop('articles',None)
 if articles is None:articles=db.query(Article).filter_by(status='published',locale=locale).order_by(Article.published_at.desc()).limit(3).all()
 path=path if path.startswith('/') else '/'+path
 canonical=base_url(req)+'/'+locale+path if path!='/' else base_url(req)+'/'+locale+'/'
 seo_title=items.pop('seo_title',None) or {'home':'VORA | Bringing the World Within Reach','about':'About VORA | Freight & Logistics','services':'Freight & Logistics Services | VORA','insights':'Insights | VORA','contact':'Contact VORA','quote':'Request a Freight Quote | VORA'}.get(kind,'VORA | Freight & Logistics')
 seo_desc=items.pop('seo_desc',None) or (items.get('service',(None,None,''))[2] if kind=='service' else 'VORA offers freight and logistics inquiry and coordination for international and domestic movements.')
 schema={'@context':'https://schema.org','@type':'Organization','name':'VORA','legalName':settings.get('legal_name','PT Satu Arah International'),'url':base_url(req)}
 # Only add administrator-entered contact fields. No invented addresses or telephone numbers.
 if settings.get('email'):schema['email']=settings['email']
 if settings.get('address'):schema['address']={'@type':'PostalAddress','streetAddress':settings['address']}
 if kind=='service':
  schema={'@context':'https://schema.org','@type':'Service','name':items.get('servicename','Freight and Logistics'),
   'description':seo_desc,'provider':{'@type':'Organization','name':'VORA'},'url':canonical,
   'serviceType':items.get('servicename','Freight and Logistics')}
 return dict(locale=locale,path=path,t=values,nav=links,settings=settings,services=SERVICES,articles=articles,year=date.today().year,kind=kind,
  canonical=canonical,seo_title=seo_title,seo_desc=seo_desc,service_groups=SERVICE_GROUPS,service_modes=SERVICE_MODES,
  alternates={i:base_url(req)+'/'+i+path for i in ['en','id']},schema=schema,**items)

def get_published_page(db,slug,locale):
 p=db.query(Page).filter_by(slug=slug,locale=locale,status='published').first()
 return p.published_snapshot if p and p.published_snapshot else None

def public(req,loc,route,db,**kwargs):
 base_kind=route.strip('/').split('/')[0] or 'home'
 if route=='/':kind='home'
 elif base_kind=='request-quote':kind='quote'
 elif base_kind=='contact':kind='contact'
 elif base_kind=='services':kind='service' if route.count('/')>=2 else 'services'
 elif base_kind=='insights':kind='article' if route.count('/')>=2 else 'insights'
 elif base_kind in ['about','solutions','network','faq','privacy','terms']:kind=base_kind
 else:kind='custom'
 data={}
 if kind=='service':
  parts=route.removeprefix('/services/').strip('/').split('/')
  if len(parts)>2 or parts[0] not in SERVICE_GROUPS:raise HTTPException(404)
  group_slug=parts[0];group=SERVICE_GROUPS[group_slug];detail=group[loc]
  child_slug=parts[1] if len(parts)==2 else None
  if child_slug and child_slug not in SERVICE_MODES.get(group_slug,{}):raise HTTPException(404)
  mode=SERVICE_MODES[group_slug][child_slug][loc] if child_slug else None
  service_name=mode[0] if mode else detail['name']
  detail_text=mode[2] if mode else detail['scope']
  data.update(service=SERVICES[group_slug][loc],service_slug=group_slug,
   service_group=group,service_group_slug=group_slug,service_detail=detail,
   service_submode=mode,service_submode_slug=child_slug,
   servicename=service_name,service_image=(mode[3] if mode else group['image']),
   seo_title=service_name+' | VORA Freight & Logistics',seo_desc=(mode[1] if mode else detail['intro']))
 elif kind=='solutions':data['solutions']=[('Manufacturing','Coordinating inbound components and finished products around factory schedules.'),('Retail & E-commerce','Evaluating inventory flows and distribution requirements.'),('Industrial Projects','Planning equipment movements and special handling feasibility.'),('General Cargo','Aligning standard cargo movement with route and documentation needs.')]
 elif kind=='network':data['coverage']=db.query(ServiceCoverage).filter_by(active=True).all()
 elif kind=='insights':
  q=str(req.query_params.get('q','')).strip()[:100];pn=max(1,min(500,int(req.query_params.get('page','1') or '1')))
  query=db.query(Article).filter_by(status='published',locale=loc)
  if q:query=query.filter(or_(Article.title.ilike('%'+q+'%'),Article.excerpt.ilike('%'+q+'%')))
  n=query.count();data.update(articles=query.order_by(Article.published_at.desc()).offset((pn-1)*12).limit(12).all(),total_pages=(n+11)//12,q=q)
 elif kind=='article':
  slug=route.split('/')[-1];a=db.query(Article).filter_by(slug=slug,locale=loc,status='published').first()
  if not a:raise HTTPException(404)
  data.update(article=a,reading_time=max(1,len(re.sub(r'<[^>]+>','',a.body).split())//230),seo_title=a.seo_title or a.title+' | VORA',seo_desc=a.seo_description or a.excerpt,og_type='article')
 elif kind=='faq':data['faqs']=db.query(Faq).filter_by(visible=True).order_by(Faq.position).all()
 elif kind in ['contact','quote']:data.update(success=bool(req.query_params.get('sent')),mode=req.query_params.get('mode',''),error=req.query_params.get('error',''))
 elif kind in ['privacy','terms']:
  data['legal_text']=clean_html(setting_map(db).get(kind,''));data['noindex']=not bool(data['legal_text'])
 elif kind=='custom':
  snap=get_published_page(db,route.lstrip('/'),loc)
  if not snap:raise HTTPException(404)
  data.update(custom_page=type('PublishedPage',(),snap)(),custom_sections=[type('PublishedSection',(),x)() for x in snap['sections']],seo_title=snap['seo_title'] or snap['title'],seo_desc=snap['seo_description'] or snap['description'])
 # Core pages can also contain published custom sections without disturbing their native modules.
 if kind!='custom' and kind not in ['article','quote','contact']:
  page_snap=get_published_page(db,route.lstrip('/') or 'home',loc)
  if page_snap:data['custom_sections']=[type('PublishedSection',(),x)() for x in page_snap['sections']]
 return html(req,'public.html',public_payload(req,db,loc,route,kind,**data))

@app.get('/',include_in_schema=False)
def root():return RedirectResponse('/en/',status_code=302)
@app.get('/robots.txt')
def robots(req:Request):return PlainTextResponse('User-agent: *\nDisallow: /admin\nDisallow: /verify\nDisallow: /uploads/private\nSitemap: '+base_url(req)+'/sitemap.xml\n')
@app.get('/sitemap.xml')
def sitemap(req:Request):
 with Session() as db:
  paths=[]
  for loc in ('en','id'):
   for path in ['/','/about','/services','/solutions','/network','/insights','/faq','/contact','/request-quote','/privacy','/terms']:
    if path in ['/privacy','/terms'] and not setting_map(db).get(path.strip('/')):continue
    paths.append('/'+loc+path)
   for slug in SERVICES:
    paths.append('/'+loc+'/services/'+slug)
    for mode in SERVICE_MODES.get(slug,{}):paths.append('/'+loc+'/services/'+slug+'/'+mode)
  for a in db.query(Article).filter_by(status='published').all():paths.append('/'+a.locale+'/insights/'+a.slug)
  for p in db.query(Page).filter_by(status='published').all():
   if p.slug not in ['', 'home','about','services','solutions','network','insights','faq','contact','request-quote','privacy','terms']:
    paths.append('/'+p.locale+'/'+p.slug)
  return Response('<?xml version="1.0" encoding="utf-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+''.join('<url><loc>'+base_url(req)+v+'</loc></url>' for v in sorted(set(paths)))+'</urlset>',media_type='application/xml')

# Never register a catchall until explicit /admin and /verify routes below.
@app.get('/verify/{token}')
def verify(token:str,req:Request):
 if len(token)>150:raise HTTPException(404)
 with Session() as db:
  row=db.query(Verification).filter_by(token_hash=hashlib.sha256(token.encode()).hexdigest()).first()
  if not row:raise HTTPException(404,'Verification token not found')
  model={'invoice':Invoice,'receipt':Receipt,'quotation':Quotation}.get(row.kind)
  if not model:raise HTTPException(404)
  doc=db.get(model,row.document_id)
  if not doc:raise HTTPException(404)
  status='VOID' if row.revoked or doc.status=='void' else ('PENDING E-METERAI' if row.kind=='receipt' and doc.status=='pending_stamp' else ('DRAFT' if doc.status=='draft' else 'AUTHENTIC'))
  payment_status=(('OFFICIALLY PAID' if doc.status=='paid' else 'PARTIALLY PAID' if doc.status=='partially_paid' else 'AWAITING PAYMENT') if row.kind=='invoice' and not row.revoked and doc.status!='void' else '')
  when=doc.issued_at if row.kind in ('invoice','quotation') else doc.created_at.date().isoformat()
  content=f'''<!doctype html><html lang="en"><head><meta name="robots" content="noindex,nofollow"><meta name="viewport" content="width=device-width,initial-scale=1"><title>VORA Document Verification</title><link rel="stylesheet" href="/static/css/site.css"></head><body><main class="wrap" style="max-width:750px;padding-top:10vh"><a href="/en/"><img src="/static/assets/vora-primary.svg" alt="VORA" width="160"></a><div class="form-panel" style="margin-top:35px"><span class="eyebrow">Document authentication</span><h1 style="font-size:3rem">{status}</h1><p><strong>Document:</strong> {row.kind.title()}<br><strong>Reference:</strong> {doc.number}<br><strong>Issuer:</strong> VORA / PT Satu Arah International<br><strong>Date:</strong> {when}</p>{f'<p><strong>Payment status:</strong> {payment_status}</p>' if payment_status else ''}<p class="note">Check the document type, reference, issuer, date, and current status. Customer and financial details remain private.</p></div></main></body></html>'''
  return HTMLResponse(content,headers={'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'})

@app.get('/admin/login')
def login_get(req:Request):
 with Session() as db:
  if current_user(req,db):return RedirectResponse('/admin',status_code=302)
 return html(req,'login.html',{'noindex':True,'error':''})
@app.post('/admin/login')
async def login_post(req:Request):
 form=await req.form();csrf_valid(req,form)
 with Session() as db:
  u=db.query(User).filter_by(email=str(form.get('email','')).strip().lower(),active=True).first()
  if not u or not password_valid(str(form.get('password','')),u.password_hash):
   return html(req,'login.html',{'noindex':True,'error':'Invalid login details'},401)
  resp=RedirectResponse('/admin',status_code=303)
  resp.set_cookie('vora_session',serializer.dumps({'id':u.id}),httponly=True,secure=IS_PROD,samesite='lax',max_age=8*3600,path='/')
  return resp
@app.get('/admin/logout')
def logout(req:Request):
 r=RedirectResponse('/admin/login',status_code=303);r.delete_cookie('vora_session',path='/');return r

LEAD_STATUSES=['new','contacted','qualified','quotation_sent','negotiation','won','lost','archived']
SETTING_FIELDS=[('legal_name','Legal company name'),('company_description','Company profile public text'),('email','Public email'),('address','Public address'),('hours','Operating hours'),('linkedin','LinkedIn URL'),('instagram','Instagram URL'),('privacy','Approved privacy notice HTML'),('terms','Approved terms HTML'),('ga4_id','GA4 measurement ID (optional)'),('gtm_id','GTM ID (optional)')]

def render_admin(req,db,section,heading,perm=None,**kw):
 user=auth(req,db,perm)
 return html(req,'admin.html',dict(user=user,section=section,heading=heading,money=money,today=date.today().isoformat(),settings=setting_map(db),lead_statuses=LEAD_STATUSES,message=req.query_params.get('notice',''),error=kw.pop('error',''),**kw))

@app.get('/admin')
def admin_dashboard(req:Request):
 with Session() as db:
  u=auth(req,db)
  counts=dict(leads=db.query(Lead).count(),new_leads=db.query(Lead).filter_by(status='new').count(),published=db.query(Article).filter_by(status='published').count(),outstanding=db.query(Invoice).filter(Invoice.status.in_(['issued','partially_paid'])).count())
  return render_admin(req,db,'dashboard','Overview',counts=counts,leads=db.query(Lead).order_by(Lead.id.desc()).limit(8).all(),invoices=db.query(Invoice).order_by(Invoice.id.desc()).limit(8).all())

@app.get('/admin/leads')
def admin_leads(req:Request):
 with Session() as db:
  auth(req,db,'crm');q=req.query_params.get('q','').strip()[:120];status=req.query_params.get('status','')
  rows=db.query(Lead)
  if q:rows=rows.filter(or_(Lead.name.ilike('%'+q+'%'),Lead.company.ilike('%'+q+'%'),Lead.email.ilike('%'+q+'%')))
  if status in LEAD_STATUSES:rows=rows.filter_by(status=status)
  return render_admin(req,db,'leads','Leads',rows=rows.order_by(Lead.id.desc()).limit(250).all(),q=q,status=status)
@app.get('/admin/leads.csv')
def leads_csv(req:Request):
 with Session() as db:
  auth(req,db,'crm');f=io.StringIO();w=csv.writer(f);cols=['id','reference','public_code','type','name','company','email','status','priority','mode','origin','destination','created_at'];w.writerow(cols)
  for r in db.query(Lead).order_by(Lead.id).all():w.writerow([getattr(r,k) for k in cols])
  return Response(f.getvalue(),media_type='text/csv',headers={'Content-Disposition':'attachment; filename="vora-leads.csv"'})
@app.get('/admin/leads/{id}')
def lead_get(id:int,req:Request):
 with Session() as db:
  auth(req,db,'crm');o=db.get(Lead,id)
  if not o:raise HTTPException(404)
  return render_admin(req,db,'lead-detail','Lead detail',obj=o,activities=db.query(LeadActivity).filter_by(lead_id=id).order_by(LeadActivity.id.desc()).all())
@app.post('/admin/leads/{id}')
async def lead_post(id:int,req:Request):
 form=await req.form();csrf_valid(req,form)
 with Session() as db:
  u=auth(req,db,'crm');obj=db.get(Lead,id)
  if not obj:raise HTTPException(404)
  if form.get('status') not in LEAD_STATUSES:raise HTTPException(422,'Invalid lead status')
  obj.status=form.get('status');obj.priority=form.get('priority','normal') if form.get('priority') in ['low','normal','high','urgent'] else 'normal';obj.assignee=str(form.get('assignee',''))[:160];obj.followup=str(form.get('followup',''))[:30]
  note=str(form.get('note','')).strip()
  if note:db.add(LeadActivity(lead_id=id,actor_id=u.id,message=note[:3000]))
  record_audit(db,u.id,'update','lead',id,obj.status);db.commit()
  return see_also(req,f'/admin/leads/{id}','Lead updated')

@app.get('/admin/settings')
def settings_get(req:Request):
 with Session() as db:return render_admin(req,db,'settings','Site settings','settings',setting_fields=SETTING_FIELDS)
@app.post('/admin/settings')
async def settings_post(req:Request):
 form=await req.form();csrf_valid(req,form)
 with Session() as db:
  u=auth(req,db,'settings');settings_update(db,[k for k,l in SETTING_FIELDS],form,u)
  return see_also(req,'/admin/settings','Public settings published')

@app.get('/admin/articles')
def articles_list(req:Request):
 with Session() as db:return render_admin(req,db,'articles','Articles','content',rows=db.query(Article).order_by(Article.updated_at.desc()).all())
@app.get('/admin/articles/new')
def articles_new(req:Request):
 with Session() as db:return render_admin(req,db,'article-form','Article editor','content',obj=None,revisions=[])
@app.get('/admin/articles/{id}')
def articles_get(id:int,req:Request):
 with Session() as db:
  o=db.get(Article,id)
  if not o:raise HTTPException(404)
  return render_admin(req,db,'article-form','Article editor','content',obj=o,revisions=db.query(Revision).filter_by(resource='article',resource_id=id).order_by(Revision.id.desc()).limit(15).all())

def article_snapshot(a):return {k:getattr(a,k) for k in ('title','slug','excerpt','body','category','tags','locale','status','cover','author','seo_title','seo_description')}

@app.post('/admin/articles/{id}')
@app.post('/admin/articles/new')
async def article_save(req:Request,id:Optional[int]=None):
 form=await req.form();csrf_valid(req,form)
 with Session() as db:
  u=auth(req,db,'content');a=db.get(Article,id) if id else Article()
  if id and not a:raise HTTPException(404)
  if id:db.add(Revision(resource='article',resource_id=id,snapshot=article_snapshot(a),author_id=u.id))
  a.title=str(form.get('title','')).strip()[:240];a.slug=slugify(str(form.get('slug','') or a.title));a.excerpt=str(form.get('excerpt',''))[:1600];a.body=clean_html(str(form.get('body','')))
  a.category=str(form.get('category','Updates'))[:80];a.tags=str(form.get('tags',''))[:400];a.locale=str(form.get('locale','en')) if form.get('locale') in ('en','id') else 'en';a.author=str(form.get('author','VORA Editorial'))[:120];a.seo_title=str(form.get('seo_title',''))[:200];a.seo_description=str(form.get('seo_description',''))[:300]
  action=str(form.get('action','draft'))
  if action=='publish':a.status='published';a.published_at=now()
  elif action=='unpublish':a.status='draft'
  elif not id:a.status='draft'
  if not a.title or not a.slug:raise HTTPException(422,'Article title and slug required')
  db.add(a)
  try:db.flush()
  except IntegrityError:db.rollback();raise HTTPException(409,'Article slug already in use')
  record_audit(db,u.id,'publish' if action=='publish' else 'update','article',a.id,a.title);db.commit()
  return see_also(req,f'/admin/articles/{a.id}',f'Article {action} saved')
@app.post('/admin/articles/{id}/restore/{rev_id}')
async def article_restore(id:int,rev_id:int,req:Request):
 form=await req.form();csrf_valid(req,form)
 with Session() as db:
  u=auth(req,db,'content');a=db.get(Article,id);r=db.get(Revision,rev_id)
  if not a or not r or r.resource!='article' or r.resource_id!=id:raise HTTPException(404)
  db.add(Revision(resource='article',resource_id=id,snapshot=article_snapshot(a),author_id=u.id))
  for k,v in r.snapshot.items():setattr(a,k,v)
  record_audit(db,u.id,'restore','article',id,str(rev_id));db.commit();return see_also(req,f'/admin/articles/{id}','Revision restored')
@app.get('/admin/articles/{id}/preview')
def article_preview(id:int,req:Request):
 with Session() as db:
  auth(req,db,'content');a=db.get(Article,id)
  if not a:raise HTTPException(404)
  return html(req,'public.html',public_payload(req,db,a.locale,'/insights/'+a.slug,'article',article=a,reading_time=max(1,len(re.sub(r'<[^>]+>','',a.body).split())//230),noindex=True))

@app.get('/admin/pages')
def pages_list(req:Request):
 with Session() as db:
  pages=db.query(Page).order_by(Page.id.desc()).all();counts=dict(db.query(Section.page_id,func.count(Section.id)).group_by(Section.page_id).all())
  return render_admin(req,db,'pages','Pages & Sections','content',rows=pages,sections_count=counts)
@app.get('/admin/pages/new')
def page_new(req:Request):
 with Session() as db:return render_admin(req,db,'page-form','Page customizer','content',obj=None,page_sections=[],revisions=[])
@app.get('/admin/pages/{id}')
def page_get(id:int,req:Request):
 with Session() as db:
  p=db.get(Page,id)
  if not p:raise HTTPException(404)
  return render_admin(req,db,'page-form','Page customizer','content',obj=p,page_sections=db.query(Section).filter_by(page_id=id).order_by(Section.position,Section.id).all(),revisions=db.query(Revision).filter_by(resource='page',resource_id=id).order_by(Revision.id.desc()).limit(12).all())

@app.post('/admin/pages/{id}')
@app.post('/admin/pages/new')
async def page_save(req:Request,id:Optional[int]=None):
 form=await req.form();csrf_valid(req,form)
 with Session() as db:
  u=auth(req,db,'content');p=db.get(Page,id) if id else Page()
  if id and not p:raise HTTPException(404)
  p.title=str(form.get('title','')).strip()[:200];p.slug=slugify(str(form.get('slug') or p.title));p.locale=str(form.get('locale','en')) if form.get('locale') in ('en','id') else 'en';p.description=str(form.get('description',''))[:1200];p.seo_title=str(form.get('seo_title',''))[:200];p.seo_description=p.description
  if not p.title or not p.slug:raise HTTPException(422,'Page title and slug required')
  db.add(p)
  try:db.flush()
  except IntegrityError:db.rollback();raise HTTPException(409,'Page slug already exists')
  action=form.get('action','draft')
  if action=='publish':
   db.add(Revision(resource='page',resource_id=p.id,snapshot=p.published_snapshot or {},author_id=u.id))
   p.published_snapshot=snapshot_page(db,p);p.status='published'
  elif action=='unpublish':p.status='draft'
  record_audit(db,u.id,action,'page',p.id,p.slug);db.commit()
  return see_also(req,f'/admin/pages/{p.id}','Page saved')
@app.get('/admin/pages/{id}/preview')
def page_preview(id:int,req:Request):
 with Session() as db:
  auth(req,db,'content');p=db.get(Page,id)
  if not p:raise HTTPException(404)
  snap=snapshot_page(db,p);data=public_payload(req,db,p.locale,'/'+p.slug,'custom',custom_page=type('X',(),snap)(),custom_sections=[type('X',(),x)() for x in snap['sections']],noindex=True)
  return html(req,'public.html',data)
@app.post('/admin/pages/{id}/sections')
async def section_add(id:int,req:Request):
 form=await req.form();csrf_valid(req,form)
 with Session() as db:
  u=auth(req,db,'content');p=db.get(Page,id)
  if not p:raise HTTPException(404)
  pos=db.query(func.max(Section.position)).filter_by(page_id=id).scalar() or 0
  s=Section(page_id=id,position=pos+1,kind='editorial',layout='split',visible=True,title='New editorial block',body='Edit this text before publishing')
  db.add(s);db.commit();return see_also(req,f'/admin/pages/{id}','Section added to draft')
@app.post('/admin/sections/{id}')
async def section_save(id:int,req:Request):
 form=await req.form();csrf_valid(req,form)
 with Session() as db:
  u=auth(req,db,'content');s=db.get(Section,id)
  if not s:raise HTTPException(404)
  pid=s.page_id
  if form.get('delete')=='1':db.delete(s)
  elif form.get('move') in ['up','down']:
   others=db.query(Section).filter_by(page_id=pid).order_by(Section.position,Section.id).all();idx=next((i for i,v in enumerate(others) if v.id==id),-1);j=idx+(-1 if form['move']=='up' else 1)
   if 0<=j<len(others):
    others[idx],others[j]=others[j],others[idx]
    for i,v in enumerate(others):v.position=i
  else:
   s.title=str(form.get('title',''))[:200];s.body=str(form.get('body',''))[:6000];s.kind=str(form.get('kind','editorial')) if form.get('kind') in ['editorial','hero','features','cta','media','faq'] else 'editorial';s.layout=str(form.get('layout','split')) if form.get('layout') in ['split','stack','center','cards'] else 'split';s.surface=str(form.get('surface','paper')) if form.get('surface') in ['paper','white','ink'] else 'paper';s.visible=form.get('visible')=='1';s.button_label=str(form.get('button_label',''))[:120];s.button_href=str(form.get('button_href',''))[:400];s.image=str(form.get('image',''))[:500]
   if s.image and not (s.image.startswith('/static/assets/') or s.image.startswith('/uploads/') or s.image.startswith('https://')):raise HTTPException(422,'Invalid image source')
  record_audit(db,u.id,'update','section',id,'section draft');db.commit();return see_also(req,f'/admin/pages/{pid}','Section draft updated. Publish page to go live')
@app.post('/admin/pages/{id}/restore/{rev_id}')
async def page_restore(id:int,rev_id:int,req:Request):
 form=await req.form();csrf_valid(req,form)
 with Session() as db:
  u=auth(req,db,'content');p=db.get(Page,id);r=db.get(Revision,rev_id)
  if not p or not r or r.resource!='page' or r.resource_id!=id:raise HTTPException(404)
  if not r.snapshot:raise HTTPException(409,'Previous revision is empty')
  p.published_snapshot=r.snapshot;p.status='published'
  record_audit(db,u.id,'restore','page',id,str(rev_id));db.commit();return see_also(req,f'/admin/pages/{id}','Published revision restored')

@app.get('/admin/customers')
def customers_list(req:Request):
 with Session() as db:return render_admin(req,db,'customers','Customers','finance',rows=db.query(Customer).order_by(Customer.id.desc()).all())
@app.get('/admin/customers/new')
def customer_new(req:Request):
 with Session() as db:return render_admin(req,db,'customer-form','New customer','finance',obj=None)
@app.get('/admin/customers/{id}')
def customer_get(id:int,req:Request):
 with Session() as db:
  c=db.get(Customer,id)
  if not c:raise HTTPException(404)
  return render_admin(req,db,'customer-form','Edit customer','finance',obj=c)
@app.post('/admin/customers/{id}')
@app.post('/admin/customers/new')
async def customer_save(req:Request,id:Optional[int]=None):
 form=await req.form();csrf_valid(req,form)
 with Session() as db:
  u=auth(req,db,'finance');c=db.get(Customer,id) if id else Customer()
  if id and not c:raise HTTPException(404)
  c.name=str(form.get('name','')).strip()[:200];c.email=str(form.get('email','')).strip()[:200];c.phone='';c.address=str(form.get('address',''))[:3000];c.tax_id=str(form.get('tax_id',''))[:100]
  if not c.name:raise HTTPException(422,'Customer name required')
  if not id:c.currency=form.get('currency','IDR') if form.get('currency') in ['IDR','USD','EUR','SGD','JPY'] else 'IDR'
  elif c.currency!=form.get('currency') and db.query(Invoice).filter_by(customer_id=id).first():raise HTTPException(409,'Currency cannot change on a customer with invoices')
  else:c.currency=form.get('currency','IDR') if form.get('currency') in ['IDR','USD','EUR','SGD','JPY'] else 'IDR'
  try:c.terms_days=max(0,min(365,int(form.get('terms_days','14'))))
  except ValueError:raise HTTPException(422,'Invalid payment terms')
  db.add(c);db.flush();ensure_public_code(db,c);record_audit(db,u.id,'upsert','customer',c.id,c.name);db.commit()
  return see_also(req,f'/admin/customers/{c.id}','Customer saved')

@app.get('/admin/quotations')
def quotations_list(req:Request):
 with Session() as db:return render_admin(req,db,'quotations','Quotations','finance',rows=db.query(Quotation).order_by(Quotation.id.desc()).all())

@app.get('/admin/quotations/new')
def quotation_new(req:Request):
 with Session() as db:
  return render_admin(req,db,'quotation-form','New quotation','finance',obj=None,customers=db.query(Customer).order_by(Customer.name).all(),leads=db.query(Lead).order_by(Lead.id.desc()).limit(300).all())

@app.get('/admin/quotations/{id}')
def quotation_get(id:int,req:Request):
 with Session() as db:
  q=db.get(Quotation,id)
  if not q:raise HTTPException(404)
  return render_admin(req,db,'quotation-form','Quotation detail','finance',obj=q,approval_requests=db.query(QuotationApproval).filter_by(quotation_id=id).order_by(QuotationApproval.id.desc()).limit(20).all())

@app.post('/admin/quotations/new')
async def quotation_post(req:Request):
 form=await req.form();csrf_valid(req,form)
 with Session() as db:
  u=auth(req,db,'finance')
  selection=str(form.get('recipient',''))
  from datetime import date as date_type
  try:
   which,raw_id=selection.split(':',1);oid=int(raw_id)
   if which not in ('customer','lead'):raise ValueError()
  except ValueError:raise HTTPException(422,'Select customer or lead')
  owner=db.get(Customer if which=='customer' else Lead,oid)
  if not owner:raise HTTPException(422,'Recipient unavailable')
  lines=[]
  for raw in str(form.get('items','')).splitlines():
   if not raw.strip():continue
   fields=[x.strip() for x in raw.split('|')]
   if len(fields) not in (3,4):raise HTTPException(422,'Line items must be description | quantity | unit price | unit')
   lines.append({'description':fields[0],'quantity':fields[1],'price':fields[2],'unit':fields[3] if len(fields)==4 else 'unit'})
  if not 1<=len(lines)<=100:raise HTTPException(422,'Quotation requires 1–100 items')
  issued=str(form.get('issued_at') or date_type.today().isoformat())
  expiry=str(form.get('valid_until') or issued)
  try:
   if date_type.fromisoformat(expiry)<date_type.fromisoformat(issued):raise ValueError('Validity must not precede issue date')
   currency=owner.currency if which=='customer' else 'IDR'
   amounts=calc_lines(lines,currency,tax=str(form.get('tax_percent','0')))
   code=ensure_public_code(db,owner)
   quote=Quotation(number=next_number(db,'QUO',code,issued),customer_id=oid if which=='customer' else None,lead_id=oid if which=='lead' else None,currency=currency,issued_at=issued,valid_until=expiry,notes=str(form.get('notes',''))[:2500],tax_percent=str(form.get('tax_percent','0')),subtotal_minor=amounts['subtotal_minor'],tax_minor=amounts['tax_minor'],total_minor=amounts['total_minor'])
   db.add(quote);db.flush()
   for item in amounts['items']:db.add(QuotationItem(quotation_id=quote.id,**item))
   create_verification(db,'quotation',quote.id)
   record_audit(db,u.id,'create','quotation',quote.id,quote.number)
   db.commit()
  except (ValueError,ArithmeticError,IntegrityError) as ex:db.rollback();raise HTTPException(422,str(ex))
  return see_also(req,f'/admin/quotations/{quote.id}','Quotation draft created')

@app.post('/admin/quotations/{id}/status')
async def quotation_status(id:int,req:Request):
 form=await req.form();csrf_valid(req,form)
 with Session() as db:
  u=auth(req,db,'finance');quote=db.execute(select(Quotation).where(Quotation.id==id).with_for_update()).scalar_one_or_none()
  if not quote:raise HTTPException(404)
  action=str(form.get('action',''))
  if action=='issue' and quote.status=='draft':quote.status='issued'
  elif action=='void' and quote.status in ('draft','issued','awaiting_approval','approved'):
   quote.status='void'
   for approval in db.query(QuotationApproval).filter(QuotationApproval.quotation_id==quote.id,QuotationApproval.status=='pending').all():approval.status='revoked'
   token=get_verification(db,'quotation',quote.id)
   if token:token.revoked=True
  else:raise HTTPException(409,'Quotation cannot make that status transition')
  record_audit(db,u.id,action,'quotation',id,quote.number);db.commit()
  return see_also(req,f'/admin/quotations/{id}','Quotation state updated')

@app.get('/admin/quotations/{id}/pdf')
def quotation_pdf(id:int,req:Request):
 with Session() as db:
  auth(req,db,'finance');doc=db.get(Quotation,id)
  if not doc:raise HTTPException(404)
  return Response(pdf_document(db,'quotation',id,base_url(req)),media_type='application/pdf',headers={'Content-Disposition':f'inline; filename="{doc.number}.pdf"','Cache-Control':'no-store'})

# Quotation customer approval is a limited-duration bearer-token workflow, separate
# from the public QR verification endpoint. Customer uploads never enter public storage.
def approval_from_token(db,raw:str):
 if not isinstance(raw,str) or not (36<=len(raw)<=150):raise HTTPException(404)
 digest=hashlib.sha256(raw.encode()).hexdigest()
 request=db.query(QuotationApproval).filter_by(token_hash=digest).first()
 if not request:raise HTTPException(404)
 return request

@app.post('/admin/quotations/{id}/request-approval')
async def quotation_request_approval(id:int,req:Request):
 form=await req.form();csrf_valid(req,form)
 from .db import EmailRule, MailConfig
 from .mail import enqueue
 with Session() as db:
  actor=auth(req,db,'finance')
  quote=db.execute(select(Quotation).where(Quotation.id==id).with_for_update()).scalar_one_or_none()
  if not quote:raise HTTPException(404)
  if quote.status not in ('issued','awaiting_approval'):
   raise HTTPException(409,'Issue quotation before requesting customer approval')
  if date.fromisoformat(quote.valid_until)<date.today():raise HTTPException(409,'Quotation validity has expired')
  recipient=quote.customer or quote.lead
  if not recipient or not recipient.email:raise HTTPException(422,'Customer or lead must have a valid email address')
  if not (db.get(MailConfig,1) and db.get(MailConfig,1).enabled and
          db.get(EmailRule,'quotation_approval_request') and db.get(EmailRule,'quotation_approval_request').enabled):
   raise HTTPException(409,'Configure and enable custom SMTP and quotation approval email rule first')
  # Enforce a single active link. Old links are explicitly revoked.
  for item in db.query(QuotationApproval).filter_by(quotation_id=quote.id,status='pending').all():item.status='revoked'
  raw=secrets.token_urlsafe(42)
  expiry=min(now()+timedelta(days=14),datetime.fromisoformat(quote.valid_until).replace(tzinfo=timezone.utc)+timedelta(days=1))
  request=QuotationApproval(quotation_id=quote.id,token_hash=hashlib.sha256(raw.encode()).hexdigest(),expires_at=expiry,status='pending')
  db.add(request);db.flush()
  verification=get_verification(db,'quotation',quote.id)
  context=dict(customer_name=recipient.name,document_number=quote.number,valid_until=quote.valid_until,
               approval_url=f'{base_url(req)}/quotation-approval/{raw}',approval_expiry=expiry.date().isoformat(),
               verify_url=f'{base_url(req)}/verify/{verification.token}' if verification else '')
  queued=enqueue(db,'quotation_approval_request',recipient.email,context,attachment_kind='quotation',attachment_id=quote.id,
                 dedupe_key=f'quotation-approval-{request.id}')
  if not queued:raise HTTPException(409,'Email provider is not ready')
  quote.status='awaiting_approval'
  record_audit(db,actor.id,'send-approval-request','quotation',id,f'Customer approval link #{request.id} expires {expiry.isoformat()}')
  db.commit()
 _notify_cleared_payment(0,base_url(req))
 return see_also(req,f'/admin/quotations/{id}','Quotation approval email queued; check SMTP outbox for delivery status')

@app.get('/quotation-approval/{token}',response_class=HTMLResponse)
def quotation_approval_view(token:str,req:Request):
 from markupsafe import escape
 with Session() as db:
  item=approval_from_token(db,token)
  quote=db.get(Quotation,item.quotation_id)
  if not quote or quote.status=='void':raise HTTPException(404)
  expired=bool(item.expires_at.replace(tzinfo=timezone.utc) < now())
  active=item.status=='pending' and not expired and quote.status=='awaiting_approval'
  status='EXPIRED' if expired and item.status=='pending' else item.status.upper()
  token_safe=str(escape(token));number=str(escape(quote.number))
  csrf=csrf_make()
  form=(f'''<form method="post" enctype="multipart/form-data" action="/quotation-approval/{token_safe}">
  <input type="hidden" name="csrf" value="{csrf}">
  <label>Full name of authorized signatory <input name="signer_name" maxlength="180" required></label>
  <label>Position / title <input name="signer_title" maxlength="180" required></label>
  <label>Signed and company-stamped quotation PDF (max 10 MB) <input name="signed_pdf" type="file" accept="application/pdf" required></label>
  <label class="ack"><input type="checkbox" name="ack" value="yes" required> I confirm I am authorized to submit the signed and company-stamped quotation for review by VORA.</label>
  <button type="submit">Submit for VORA review</button></form>''' if active else '<p>This request is no longer accepting documents. Please contact VORA by email.</p>')
  markup=f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Customer approval | VORA</title><style>body{{margin:0;background:#F7F7F4;color:#101720;font:16px/1.6 Inter,system-ui,sans-serif}}main{{max-width:680px;margin:8vh auto;background:white;border:1px solid #DCE0E1;border-radius:22px;padding:clamp(24px,5vw,45px);box-shadow:0 15px 65px #10172014}}h1{{font-size:clamp(26px,4vw,39px);line-height:1.15}}small{{color:#B43E31;font-weight:700;letter-spacing:.1em}}label{{display:block;margin:17px 0;font-weight:600}}input:not([type=checkbox]){{display:block;margin-top:6px;padding:13px;width:100%;box-sizing:border-box;border:1px solid #DCE0E1;border-radius:9px}}.ack{{display:flex;gap:9px;font-weight:400}}button,.link{{display:inline-block;background:#101720;color:white;padding:13px 21px;border:0;border-radius:9px;cursor:pointer;text-decoration:none}}a{{color:#B43E31}}.state{{background:#F7F7F4;padding:10px;border-radius:9px}}</style></head><body><main><img src="/static/assets/vora-primary.svg" alt="VORA" width="135"><small><p>CUSTOMER APPROVAL WORKFLOW</p></small><h1>Review and approve quotation</h1><p>Quotation: <strong>{number}</strong></p><p class="state">Approval status: <strong>{status}</strong></p><p><a href="/quotation-approval/{token_safe}/pdf">Download quotation PDF</a>. Sign and apply your company's stamp to the quotation before uploading the complete PDF for VORA review.</p>{form}<p><small>Uploading a document does not automatically constitute VORA's acceptance. The document will be reviewed by an authorized administrator.</small></p></main></body></html>'''
  response=HTMLResponse(markup,headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow'})
  response.set_cookie('vora_csrf',csrf,secure=IS_PROD,httponly=True,samesite='lax',max_age=12*3600,path='/')
  return response

@app.get('/quotation-approval/{token}/pdf')
def quotation_approval_source_pdf(token:str,req:Request):
 with Session() as db:
  item=approval_from_token(db,token)
  quote=db.get(Quotation,item.quotation_id)
  if not quote or quote.status=='void' or item.status not in ('pending','submitted') or item.expires_at.replace(tzinfo=timezone.utc)<now():raise HTTPException(410,'Approval request unavailable')
  return Response(pdf_document(db,'quotation',quote.id,base_url(req)),media_type='application/pdf',headers={'Content-Disposition':'attachment; filename="VORA_Quotation.pdf"','Cache-Control':'no-store','Referrer-Policy':'no-referrer'})

@app.post('/quotation-approval/{token}')
async def quotation_approval_submission(token:str,req:Request):
 form=await req.form();csrf_valid(req,form)
 if form.get('ack')!='yes':raise HTTPException(422,'Authorization confirmation required')
 signer=str(form.get('signer_name','')).strip()[:180]
 title=str(form.get('signer_title','')).strip()[:180]
 upload=form.get('signed_pdf')
 if len(signer)<3 or not title or not hasattr(upload,'read'):raise HTTPException(422,'Signatory, title, and signed PDF are required')
 from .receipt_stamp import MAX_STAMPED_PDF,inspect_signed_quotation,save_quotation_approval_pdf
 data=await upload.read(MAX_STAMPED_PDF+1)
 with Session() as db:
  item=db.execute(select(QuotationApproval).where(QuotationApproval.token_hash==hashlib.sha256(token.encode()).hexdigest()).with_for_update()).scalar_one_or_none()
  if not item:raise HTTPException(404)
  quote=db.get(Quotation,item.quotation_id)
  if item.status!='pending' or item.expires_at.replace(tzinfo=timezone.utc)<now() or not quote or quote.status!='awaiting_approval':
   raise HTTPException(410,'Approval request expired or already used')
  try:digest=inspect_signed_quotation(data,quote.number)
  except ValueError as exc:raise HTTPException(422,str(exc))
  item.signed_pdf_key=save_quotation_approval_pdf(item.id,data)
  item.signed_pdf_sha256=digest
  item.signer_name=signer;item.signer_title=title;item.uploaded_at=now();item.status='submitted'
  record_audit(db,None,'customer-approval-upload','quotation',quote.id,f'Customer submission #{item.id}, SHA256 {digest}')
  db.commit()
 return HTMLResponse('<html lang="en"><meta name="robots" content="noindex,nofollow"><body style="font:16px system-ui;padding:40px;max-width:600px"><h1>Document received</h1><p>Your signed quotation has been submitted for review by VORA. This is not an automatic approval confirmation.</p></body></html>',headers={'Cache-Control':'no-store','X-Robots-Tag':'noindex,nofollow'})

@app.get('/admin/quotation-approvals/{id}/file')
def quotation_approval_file(id:int,req:Request):
 from .receipt_stamp import load_quotation_approval_pdf
 with Session() as db:
  auth(req,db,'finance');item=db.get(QuotationApproval,id)
  if not item or not item.signed_pdf_key:raise HTTPException(404)
  content=load_quotation_approval_pdf(item.signed_pdf_key)
  if hashlib.sha256(content).hexdigest()!=item.signed_pdf_sha256:raise HTTPException(409,'Stored PDF does not match uploaded fingerprint')
  return Response(content,media_type='application/pdf',headers={'Content-Disposition':f'attachment; filename="signed-quotation-{id}.pdf"','Cache-Control':'no-store'})

@app.post('/admin/quotation-approvals/{id}/review')
async def quotation_approval_review(id:int,req:Request):
 form=await req.form();csrf_valid(req,form)
 outcome=str(form.get('action',''))
 if outcome not in ('approve','reject'):raise HTTPException(422,'Invalid review outcome')
 with Session() as db:
  actor=auth(req,db,'finance')
  item=db.execute(select(QuotationApproval).where(QuotationApproval.id==id).with_for_update()).scalar_one_or_none()
  if not item or item.status!='submitted':raise HTTPException(409,'Only submitted approvals can be reviewed')
  quote=db.execute(select(Quotation).where(Quotation.id==item.quotation_id).with_for_update()).scalar_one()
  if quote.status!='awaiting_approval':raise HTTPException(409,'Quotation no longer awaiting approval')
  if outcome=='approve' and form.get('signature_and_stamp_verified')!='yes':raise HTTPException(422,'Confirm manual visual inspection of signature and company stamp')
  item.status='approved' if outcome=='approve' else 'rejected'
  item.reviewed_by=actor.id;item.reviewed_at=now();item.review_note=str(form.get('review_note',''))[:2000]
  quote.status='approved' if outcome=='approve' else 'issued'
  record_audit(db,actor.id,'customer-quotation-'+outcome,'quotation',quote.id,f'Approval #{item.id}; PDF checksum {item.signed_pdf_sha256}')
  db.commit()
 return see_also(req,f'/admin/quotations/{quote.id}',f'Customer document {item.status}; quotation status updated')

def bank_snapshot(bank):
 return {key:getattr(bank,key) or '' for key in ('bank_name','account_number','account_holder','currency','branch','swift_code')}

@app.get('/admin/bank-accounts')
def bank_accounts_list(req:Request):
 with Session() as db:
  return render_admin(req,db,'bank-accounts','Company bank accounts','finance',rows=db.query(BankAccount).order_by(BankAccount.currency,BankAccount.position,BankAccount.id).all())

@app.post('/admin/bank-accounts')
async def bank_accounts_create(req:Request):
 form=await req.form();csrf_valid(req,form)
 with Session() as db:
  u=auth(req,db,'finance')
  name=str(form.get('bank_name','')).strip()[:120]
  number=str(form.get('account_number','')).strip().replace(' ','')[:60]
  holder=str(form.get('account_holder','')).strip()[:200]
  curr=str(form.get('currency','IDR')).strip().upper()
  swift=str(form.get('swift_code','')).strip().upper()[:25]
  if not name or not holder or not re.fullmatch(r'[0-9A-Za-z-]{5,60}',number) or not re.fullmatch(r'[A-Z]{3}',curr) or (swift and not re.fullmatch(r'[A-Z0-9]{8}([A-Z0-9]{3})?',swift)):
   raise HTTPException(422,'Bank, account holder, account number, currency or SWIFT is invalid')
  existing=db.query(BankAccount).filter_by(currency=curr,is_default=True).all()
  primary=form.get('is_default')=='1' or not existing
  if primary:
   for x in existing:x.is_default=False
   db.flush()
  bank=BankAccount(bank_name=name,account_number=number,account_holder=holder,currency=curr,branch=str(form.get('branch','')).strip()[:150],swift_code=swift,notes=str(form.get('notes','')).strip()[:250],active=True,is_default=primary,position=db.query(BankAccount).count()+1)
  db.add(bank)
  try:
   db.flush();record_audit(db,u.id,'create','bank-account',bank.id,f'{name} / {curr}');db.commit()
  except IntegrityError:db.rollback();raise HTTPException(409,'Bank account already exists')
  return see_also(req,'/admin/bank-accounts','Bank account saved')

@app.post('/admin/bank-accounts/{id}')
async def bank_accounts_edit(id:int,req:Request):
 form=await req.form();csrf_valid(req,form)
 with Session() as db:
  u=auth(req,db,'finance')
  bank=db.execute(select(BankAccount).where(BankAccount.id==id).with_for_update()).scalar_one_or_none()
  if not bank:raise HTTPException(404)
  action=str(form.get('action','save'))
  if action=='default':
   if not bank.active:raise HTTPException(409,'Inactive account cannot be default')
   for x in db.query(BankAccount).filter_by(currency=bank.currency,is_default=True).all():x.is_default=False
   db.flush()
   bank.is_default=True
  elif action=='disable':
   bank.active=False;bank.is_default=False
  elif action=='enable':
   bank.active=True
   if not db.query(BankAccount).filter_by(currency=bank.currency,is_default=True).first():bank.is_default=True
  elif action=='save':
   name=str(form.get('bank_name','')).strip()[:120]
   number=str(form.get('account_number','')).strip().replace(' ','')[:60]
   holder=str(form.get('account_holder','')).strip()[:200]
   swift=str(form.get('swift_code','')).strip().upper()[:25]
   if not name or not holder or not re.fullmatch(r'[0-9A-Za-z-]{5,60}',number) or (swift and not re.fullmatch(r'[A-Z0-9]{8}([A-Z0-9]{3})?',swift)):raise HTTPException(422,'Invalid bank details')
   bank.bank_name=name;bank.account_number=number;bank.account_holder=holder
   bank.branch=str(form.get('branch','')).strip()[:150];bank.swift_code=swift;bank.notes=str(form.get('notes','')).strip()[:250]
  else:raise HTTPException(422,'Invalid action')
  try:
   record_audit(db,u.id,action,'bank-account',id,bank.bank_name);db.commit()
  except IntegrityError:db.rollback();raise HTTPException(409,'Bank account already exists')
  return see_also(req,'/admin/bank-accounts','Bank account updated')

@app.get('/admin/invoices')
def invoices_list(req:Request):
 with Session() as db:return render_admin(req,db,'invoices','Invoices','finance',rows=db.query(Invoice).order_by(Invoice.id.desc()).all())
@app.get('/admin/invoices/new')
def invoice_new(req:Request):
 with Session() as db:return render_admin(req,db,'invoice-form','Create invoice','finance',obj=None,customers=db.query(Customer).order_by(Customer.name).all(),bank_accounts=db.query(BankAccount).filter_by(active=True).order_by(BankAccount.currency,BankAccount.is_default.desc(),BankAccount.position).all(),payments=[],receipt_by_payment={})
@app.get('/admin/invoices/{id}')
def invoice_get(id:int,req:Request):
 with Session() as db:
  inv=db.get(Invoice,id)
  if not inv:raise HTTPException(404)
  payments=db.query(Payment).filter_by(invoice_id=id).order_by(Payment.id.desc()).all()
  recs=db.query(Receipt).filter_by(invoice_id=id).all()
  return render_admin(req,db,'invoice-form','Invoice detail','finance',obj=inv,payments=payments,receipt_by_payment={r.payment_id:r for r in recs},bank_accounts=db.query(BankAccount).filter_by(active=True,currency=inv.currency).order_by(BankAccount.position).all())

@app.post('/admin/invoices/new')
async def invoice_post(req:Request):
 form=await req.form();csrf_valid(req,form)
 with Session() as db:
  u=auth(req,db,'finance')
  try:cid=int(form.get('customer_id','0'))
  except ValueError:raise HTTPException(422,'Invalid customer')
  c=db.get(Customer,cid)
  if not c:raise HTTPException(422,'Select existing customer')
  lines=[]
  for line in str(form.get('items','')).splitlines():
   if not line.strip():continue
   fields=[f.strip() for f in line.split('|')]
   if len(fields) not in (3,4):raise HTTPException(422,'Each line must be description | quantity | unit price | unit')
   lines.append(dict(description=fields[0],quantity=fields[1],price=fields[2],unit=fields[3] if len(fields)==4 else 'unit'))
  if not lines or len(lines)>100:raise HTTPException(422,'Require 1–100 line items')
  try:
   discount_minor=units(form.get('discount','0'),c.currency)
   calculations=calc_lines(lines,c.currency,str(form.get('tax_percent','0')),str(form.get('withholding_percent','0')),discount_minor)
  except (ValueError,ArithmeticError) as e:raise HTTPException(422,str(e))
  issued=str(form.get('issued_at') or date.today().isoformat())
  due=str(form.get('due_at') or issued)
  try:
   if date.fromisoformat(due)<date.fromisoformat(issued):raise ValueError('Due date before issue date')
  except ValueError as e:raise HTTPException(422,'Invalid invoice dates: '+str(e))
  try:
   customer_code=ensure_public_code(db,c)
   inv=Invoice(number=next_number(db,'INV',customer_code,issued),customer_id=cid,status='draft',currency=c.currency,issued_at=issued,due_at=due,po_number=str(form.get('po_number',''))[:100],shipment_reference=str(form.get('shipment_reference',''))[:120],service_mode=str(form.get('service_mode',''))[:120],origin=str(form.get('origin',''))[:180],destination=str(form.get('destination',''))[:180],transport_document_ref=str(form.get('transport_document_ref',''))[:150],notes=str(form.get('notes',''))[:2500],tax_percent=str(form.get('tax_percent','0')),withholding_percent=str(form.get('withholding_percent','0')),discount_minor=discount_minor,**{k:calculations[k] for k in ('subtotal_minor','tax_minor','withholding_minor','total_minor')},outstanding_minor=calculations['total_minor'])
   db.add(inv);db.flush()
   selected_ids=[]
   for raw in form.getlist('bank_account_ids'):
    try:selected_ids.append(int(raw))
    except (ValueError,TypeError):raise HTTPException(422,'Invalid selected bank account')
   if len(selected_ids)!=len(set(selected_ids)) or len(selected_ids)>8:raise HTTPException(422,'Select at most eight distinct accounts')
   if not selected_ids:
    default_bank=db.query(BankAccount).filter_by(currency=c.currency,active=True,is_default=True).first()
    if default_bank:selected_ids=[default_bank.id]
   for pos,bank_id in enumerate(selected_ids):
    bank=db.get(BankAccount,bank_id)
    if not bank or not bank.active or bank.currency!=c.currency:raise HTTPException(422,'Only active bank accounts matching invoice currency can be selected')
    db.add(InvoiceBankInstruction(invoice_id=inv.id,bank_account_id=bank.id,position=pos,**bank_snapshot(bank)))
   for item in calculations['items']:db.add(InvoiceItem(invoice_id=inv.id,**item))
   create_verification(db,'invoice',inv.id)
   record_audit(db,u.id,'create','invoice',inv.id,inv.number)
   db.commit()
  except IntegrityError:db.rollback();raise HTTPException(409,'Invoice numbering collision, retry safely')
  return see_also(req,f'/admin/invoices/{inv.id}','Invoice draft created')

@app.post('/admin/invoices/{id}/status')
async def invoice_status(id:int,req:Request):
 form=await req.form();csrf_valid(req,form)
 with Session() as db:
  u=auth(req,db,'finance')
  inv=db.execute(select(Invoice).where(Invoice.id==id).with_for_update()).scalar_one_or_none()
  if not inv:raise HTTPException(404)
  action=form.get('action')
  if action=='issue' and inv.status=='draft':inv.status='issued'
  elif action=='void' and inv.status not in ['void','paid','partially_paid']:
   inv.status='void';v=get_verification(db,'invoice',id)
   if v:v.revoked=True
  else:raise HTTPException(409,'Invalid state transition; reverse payments separately before voiding')
  record_audit(db,u.id,action,'invoice',id,inv.number);db.commit();return see_also(req,f'/admin/invoices/{id}','Invoice state updated')

@app.post('/admin/invoices/{id}/payment')
async def invoice_payment(id:int,req:Request):
 """Create a pending payment claim; do not issue a receipt or reduce AR."""
 form=await req.form();csrf_valid(req,form)
 with Session() as db:
  u=auth(req,db,'finance');inv=db.get(Invoice,id)
  if not inv:raise HTTPException(404)
  try:
   payment=payment_record(db,inv,str(form.get('amount','')),str(form.get('date','')),str(form.get('method',''))[:100],str(form.get('reference',''))[:160])
   bank_raw=str(form.get('receiving_bank_id','')).strip()
   if bank_raw:
    try:bank_id=int(bank_raw)
    except ValueError:raise HTTPException(422,'Invalid receiving bank account')
    receiving=db.get(BankAccount,bank_id)
    if not receiving or not receiving.active or receiving.currency!=inv.currency:raise HTTPException(422,'Receiving bank account is inactive or mismatched to invoice currency')
    payment.receiving_bank_id=receiving.id
    payment.receiving_bank_snapshot=bank_snapshot(receiving)
   record_audit(db,u.id,'payment-pending','invoice',id,f'Payment #{payment.id}: {payment.amount_minor} {inv.currency}; not cleared')
   db.commit()
  except (ValueError,ArithmeticError,IntegrityError) as e:db.rollback();raise HTTPException(422,str(e))
  return see_also(req,f'/admin/invoices/{id}','Payment pending bank confirmation. Invoice balance unchanged.')


def _notify_cleared_payment(payment_id:int,base:str):
 """SMTP best effort after committed confirmation; never undo accounting due to mail failure."""
 from .mail import dispatch
 try:
  with Session() as mail_db:
   return dispatch(mail_db,base,limit=10)
 except Exception:
  return {'sent':0,'failed':1}

@app.post('/admin/payments/{id}/confirm')
async def confirm_payment(id:int,req:Request):
 """Only finance roles may acknowledge effective funds in the issuer's bank."""
 form=await req.form();csrf_valid(req,form)
 if form.get('funds_cleared')!='yes':raise HTTPException(422,'Confirm effective bank credit before issuing a receipt')
 with Session() as db:
  u=auth(req,db,'finance')
  p=db.execute(select(Payment).where(Payment.id==id).with_for_update()).scalar_one_or_none()
  if not p:raise HTTPException(404)
  if p.status!='pending_confirmation':raise HTTPException(409,'Payment already confirmed, cancelled or voided')
  inv=db.execute(select(Invoice).where(Invoice.id==p.invoice_id).with_for_update()).scalar_one()
  if inv.status in ('draft','void'):raise HTTPException(409,'Invoice not eligible for payment confirmation')
  confirmed_total=sum(row.amount_minor for row in db.query(Payment).filter_by(invoice_id=inv.id,status='recorded').all())
  if p.amount_minor>inv.total_minor-confirmed_total:raise HTTPException(409,'Payment exceeds invoice outstanding')
  if p.method.lower().strip() in ('bank transfer','transfer') and not p.receiving_bank_snapshot:
   raise HTTPException(422,'Select the VORA receiving bank account for a bank transfer')
  p.status='recorded';p.confirmed_at=now();p.confirmed_by=u.id
  db.flush() # balance includes the newly confirmed payment
  recompute_outstanding(db,inv)
  from .receipt_stamp import requires_stamp
  needs_stamp=requires_stamp(inv.currency,p.amount_minor)
  rec=Receipt(number=next_number(db,'RCP',ensure_public_code(db,inv.customer),p.date),invoice_id=inv.id,payment_id=p.id,status='pending_stamp' if needs_stamp else 'issued',stamp_required=needs_stamp)
  db.add(rec);db.flush();create_verification(db,'receipt',rec.id);db.flush()
  from .mail import enqueue
  if inv.customer.email:
   context=dict(customer_name=inv.customer.name,invoice_number=inv.number,payment_amount=money(p.amount_minor,inv.currency),payment_date=p.date,payment_reference=p.reference or 'Not provided',invoice_status='OFFICIALLY PAID' if inv.status=='paid' else 'PARTIALLY PAID',outstanding_amount=money(inv.outstanding_minor,inv.currency))
   enqueue(db,'payment_confirmed',inv.customer.email,context,dedupe_key=f'payment-confirmed-{p.id}')
   if not needs_stamp:
    ver=get_verification(db,'receipt',rec.id)
    enqueue(db,'receipt_customer',inv.customer.email,dict(customer_name=inv.customer.name,document_number=rec.number,verify_url=f'{base_url(req)}/verify/{ver.token}'),attachment_kind='receipt',attachment_id=rec.id,dedupe_key=f'receipt-send-{rec.id}')
  record_audit(db,u.id,'confirm-cleared-payment','payment',p.id,f'Invoice {inv.number}; receipt {rec.number}; {inv.status}; bank credit confirmed')
  db.commit()
  inv_id=inv.id; rec_id=rec.id; requires_emeterai=needs_stamp
 _notify_cleared_payment(id,base_url(req))
 return see_also(req,f'/admin/receipts/{rec_id}' if requires_emeterai else f'/admin/invoices/{inv_id}','Funds confirmed; invoice recalculated and customer email queued when SMTP rule enabled')

@app.post('/admin/payments/{id}/cancel')
async def cancel_pending_payment(id:int,req:Request):
 form=await req.form();csrf_valid(req,form)
 with Session() as db:
  u=auth(req,db,'finance')
  payment=db.execute(select(Payment).where(Payment.id==id).with_for_update()).scalar_one_or_none()
  if not payment:raise HTTPException(404)
  if payment.status!='pending_confirmation':raise HTTPException(409,'Only pending payments may be cancelled here')
  payment.status='cancelled'
  record_audit(db,u.id,'cancel-unconfirmed-payment','payment',id,'No funds confirmed')
  db.commit();return see_also(req,f'/admin/invoices/{payment.invoice_id}','Pending payment cancelled')

@app.post('/admin/invoices/{id}/send')
async def invoice_send_customer(id:int,req:Request):
 form=await req.form();csrf_valid(req,form)
 from .db import EmailRule,MailConfig
 from .mail import enqueue
 with Session() as db:
  actor=auth(req,db,'finance');invoice=db.get(Invoice,id)
  if not invoice:raise HTTPException(404)
  if invoice.status in ('draft','void'):raise HTTPException(409,'Issue invoice before customer email')
  if not invoice.customer.email:raise HTTPException(422,'Customer billing email not set')
  conf=db.get(MailConfig,1);rule=db.get(EmailRule,'invoice_customer')
  if not conf or not conf.enabled or not rule or not rule.enabled:raise HTTPException(409,'Enable SMTP and invoice_customer email rule first')
  ver=get_verification(db,'invoice',id)
  if not ver or ver.revoked:raise HTTPException(409,'Missing active document verification')
  context=dict(customer_name=invoice.customer.name,document_number=invoice.number,document_date=invoice.issued_at,
               verify_url=f'{base_url(req)}/verify/{ver.token}')
  mail=enqueue(db,'invoice_customer',invoice.customer.email,context,attachment_kind='invoice',attachment_id=id,
               dedupe_key=f'invoice-customer-{id}')
  if not mail:raise HTTPException(409,'Email transport is disabled')
  record_audit(db,actor.id,'send-invoice','invoice',id,'Invoice PDF queued via configured SMTP')
  db.commit()
 _notify_cleared_payment(0,base_url(req))
 return see_also(req,f'/admin/invoices/{id}','Invoice email queued; verify delivery in SMTP outbox')

@app.get('/admin/invoices/{id}/pdf')
def invoice_pdf(id:int,req:Request):
 with Session() as db:
  auth(req,db,'finance');obj=db.get(Invoice,id)
  if not obj:raise HTTPException(404)
  return Response(pdf_document(db,'invoice',id,base_url(req)),media_type='application/pdf',headers={'Content-Disposition':f'inline; filename="{obj.number}.pdf"','Cache-Control':'no-store'})
@app.get('/admin/receipts')
def receipts_list(req:Request):
 with Session() as db:return render_admin(req,db,'receipts','Receipts','finance',rows=db.query(Receipt).order_by(Receipt.id.desc()).all())
@app.get('/admin/receipts/{id}')
def receipt_get(id:int,req:Request):
 with Session() as db:
  rec=db.get(Receipt,id)
  if not rec:raise HTTPException(404)
  return render_admin(req,db,'receipt-detail','Receipt detail','finance',obj=rec)
@app.get('/admin/receipts/{id}/pdf')
def receipt_pdf(id:int,req:Request):
 with Session() as db:
  auth(req,db,'finance');obj=db.get(Receipt,id)
  if not obj:raise HTTPException(404)
  payment=db.get(Payment,obj.payment_id)
  if not payment or payment.status!='recorded':raise HTTPException(409,'Cannot issue receipt before funds are confirmed')
  return Response(pdf_document(db,'receipt',id,base_url(req)),media_type='application/pdf',headers={'Content-Disposition':f'inline; filename="{obj.number}.pdf"','Cache-Control':'no-store'})
@app.post('/admin/receipts/{id}/stamp')
async def receipt_stamp_upload(id:int,req:Request):
 form=await req.form();csrf_valid(req,form)
 with Session() as db:
  u=auth(req,db,'finance');receipt=db.execute(select(Receipt).where(Receipt.id==id).with_for_update()).scalar_one_or_none()
  if not receipt or receipt.status!='pending_stamp' or not receipt.stamp_required:raise HTTPException(409,'Receipt not awaiting manual e-meterai')
  ref=str(form.get('stamp_provider_reference','')).strip()[:160]
  approved=form.get('approved')=='1'
  file=form.get('stamped_pdf')
  if not approved or len(ref)<6 or not (hasattr(file,'read') and hasattr(file,'filename')):raise HTTPException(422,'Official e-meterai reference, approval and PDF are required')
  from .receipt_stamp import MAX_STAMPED_PDF,inspect_uploaded_pdf,save_stamped_pdf
  binary=await file.read(MAX_STAMPED_PDF+1)
  inv=db.get(Invoice,receipt.invoice_id)
  try:digest=inspect_uploaded_pdf(binary,receipt.number,inv.number)
  except ValueError as e:raise HTTPException(422,str(e))
  key=save_stamped_pdf(receipt.id,binary)
  receipt.stamp_storage_key=key;receipt.stamp_sha256=digest;receipt.stamp_uploaded_at=now();receipt.stamp_uploaded_by=u.id;receipt.stamp_provider_reference=ref;receipt.status='issued'
  from .mail import enqueue
  customer=inv.customer
  if customer.email:
   ver=get_verification(db,'receipt',id)
   enqueue(db,'receipt_customer',customer.email,dict(customer_name=customer.name,document_number=receipt.number,verify_url=f'{base_url(req)}/verify/{ver.token}'),attachment_kind='receipt',attachment_id=id,dedupe_key=f'receipt-send-{id}')
  record_audit(db,u.id,'stamp-upload','receipt',id,f'Official e-meterai reference: {ref}; sha256: {digest}');db.commit()
 _notify_cleared_payment(receipt.payment_id,base_url(req))
 return see_also(req,f'/admin/receipts/{id}','Stamped receipt stored; customer notification queued if enabled')

@app.post('/admin/receipts/{id}/void')
async def receipt_void(id:int,req:Request):
 form=await req.form();csrf_valid(req,form)
 with Session() as db:
  u=auth(req,db,'finance');r=db.get(Receipt,id)
  if not r or r.status=='void':raise HTTPException(409,'Receipt missing or already void')
  inv=db.execute(select(Invoice).where(Invoice.id==r.invoice_id).with_for_update()).scalar_one()
  p=db.get(Payment,r.payment_id)
  if not p or p.status!='recorded':raise HTTPException(409,'Payment not in recorded status')
  r.status='void';p.status='void';ver=get_verification(db,'receipt',id)
  if ver:ver.revoked=True
  db.flush()
  recompute_outstanding(db,inv)
  record_audit(db,u.id,'void-payment-and-receipt','receipt',id,r.number);db.commit()
  return see_also(req,f'/admin/receipts/{id}','Receipt voided; payment reversed and invoice recalculated')

@app.get('/admin/faq')
def admin_faq(req:Request):
 with Session() as db:return render_admin(req,db,'faq','FAQs','content',rows=db.query(Faq).order_by(Faq.position,Faq.id).all())
@app.post('/admin/faq')
async def faq_add(req:Request):
 form=await req.form();csrf_valid(req,form)
 with Session() as db:
  u=auth(req,db,'content');q=str(form.get('question','')).strip()[:400];a=str(form.get('answer','')).strip()[:4000]
  if not q or not a:raise HTTPException(422)
  x=Faq(question=q,answer=a,visible=True);db.add(x);db.flush();record_audit(db,u.id,'create','faq',x.id);db.commit()
  return see_also(req,'/admin/faq','FAQ published')
@app.post('/admin/faq/{id}')
async def faq_update(id:int,req:Request):
 form=await req.form();csrf_valid(req,form)
 with Session() as db:
  u=auth(req,db,'content');x=db.get(Faq,id)
  if not x:raise HTTPException(404)
  if form.get('delete')=='1':db.delete(x)
  else:x.question=str(form.get('question',''))[:400];x.answer=str(form.get('answer',''))[:4000]
  record_audit(db,u.id,'update','faq',id);db.commit();return see_also(req,'/admin/faq','FAQ updated')

@app.get('/admin/coverage')
def coverage_list(req:Request):
 with Session() as db:return render_admin(req,db,'coverage','Verified coverage','settings',rows=db.query(ServiceCoverage).order_by(ServiceCoverage.id.desc()).all())
@app.post('/admin/coverage')
async def coverage_add(req:Request):
 form=await req.form();csrf_valid(req,form)
 with Session() as db:
  u=auth(req,db,'settings');x=ServiceCoverage(region=str(form.get('region',''))[:160],mode=str(form.get('mode',''))[:100],active=form.get('active')=='1',verified_at=now() if form.get('active')=='1' else None)
  if not x.region:raise HTTPException(422)
  db.add(x);db.flush();record_audit(db,u.id,'create','coverage',x.id);db.commit();return see_also(req,'/admin/coverage','Coverage saved')
@app.post('/admin/coverage/{id}')
async def coverage_toggle(id:int,req:Request):
 form=await req.form();csrf_valid(req,form)
 with Session() as db:
  u=auth(req,db,'settings');x=db.get(ServiceCoverage,id)
  if not x:raise HTTPException(404)
  x.active=not x.active;x.verified_at=now() if x.active else None;record_audit(db,u.id,'toggle','coverage',id);db.commit();return see_also(req,'/admin/coverage','Coverage updated')

@app.get('/admin/navigation')
def nav_list(req:Request):
 with Session() as db:return render_admin(req,db,'navigation','Navigation','content',rows=db.query(Nav).order_by(Nav.position).all())
@app.post('/admin/navigation')
async def nav_add(req:Request):
 form=await req.form();csrf_valid(req,form)
 with Session() as db:
  u=auth(req,db,'content')
  try:path=clean_path(str(form.get('href','')))
  except UserError as e:raise HTTPException(422,str(e))
  if is_admin_navigation(path):raise HTTPException(422,'Internal admin routes cannot be added to public navigation')
  n=Nav(label=str(form.get('label',''))[:100],href=path,location='footer' if form.get('location')=='footer' else 'header',position=int(form.get('position','50')),visible=True)
  if not n.label:raise HTTPException(422)
  db.add(n);db.flush();record_audit(db,u.id,'create','navigation',n.id);db.commit();return see_also(req,'/admin/navigation','Navigation item saved')
@app.post('/admin/navigation/{id}/delete')
async def nav_delete(id:int,req:Request):
 form=await req.form();csrf_valid(req,form)
 with Session() as db:
  u=auth(req,db,'content');x=db.get(Nav,id)
  if not x:raise HTTPException(404)
  db.delete(x);record_audit(db,u.id,'delete','navigation',id);db.commit();return see_also(req,'/admin/navigation','Navigation removed')

@app.get('/admin/media')
def media_list(req:Request):
 with Session() as db:return render_admin(req,db,'media','Media library','content',rows=db.query(Media).order_by(Media.id.desc()).limit(80).all())
@app.post('/admin/media')
async def media_upload(req:Request,image:UploadFile=File(...),alt:str=Form(''),csrf:str=Form('')):
 csrf_valid(req,{'csrf':csrf})
 with Session() as db:
  u=auth(req,db,'content')
  from PIL import Image
  limit=7_000_000;binary=await image.read(limit+1)
  if len(binary)>limit:raise HTTPException(413,'File exceeds 7 MB limit')
  try:
   image_obj=Image.open(io.BytesIO(binary));image_obj.verify()
   detected=Image.open(io.BytesIO(binary)).format
  except Exception:raise HTTPException(415,'Invalid image file')
  mime={'PNG':'image/png','JPEG':'image/jpeg','WEBP':'image/webp','AVIF':'image/avif'}.get(detected)
  if not mime:raise HTTPException(415,'Only PNG, JPEG, WEBP and AVIF supported')
  extension={'PNG':'.png','JPEG':'.jpg','WEBP':'.webp','AVIF':'.avif'}[detected]
  key=secrets.token_hex(18)+extension;alt=alt.strip()[:400]
  if not alt:raise HTTPException(422,'Alt text required')
  if IS_PROD:
   domain=os.getenv('SUPABASE_URL','').rstrip('/');key_secret=os.getenv('SUPABASE_SERVICE_ROLE_KEY','');bucket=os.getenv('SUPABASE_STORAGE_BUCKET','vora-media')
   if not domain or not key_secret:raise HTTPException(503,'Storage not configured')
   uri=f'{domain}/storage/v1/object/{bucket}/{key}'
   req_u=urllib.request.Request(uri,data=binary,method='POST',headers={'Authorization':'Bearer '+key_secret,'apikey':key_secret,'Content-Type':mime,'x-upsert':'false'})
   try:
    with urllib.request.urlopen(req_u,timeout=25) as result:result.read()
   except Exception:raise HTTPException(502,'Storage provider upload failed')
   url=f'{domain}/storage/v1/object/public/{bucket}/{key}'
  else:
   (ROOT.parent/'uploads'/key).write_bytes(binary);url='/uploads/'+key
  obj=Media(filename=Path(image.filename or 'upload').name[:250],storage_key=key,url=url,alt=alt,mime=mime,size=len(binary));db.add(obj);db.flush();record_audit(db,u.id,'upload','media',obj.id);db.commit()
  return see_also(req,'/admin/media','Image uploaded')

@app.get('/admin/seo')
def seo_list(req:Request):
 with Session() as db:return render_admin(req,db,'seo','SEO & redirects','settings',rows=db.query(Redirect).all())
@app.post('/admin/seo')
async def seo_add(req:Request):
 form=await req.form();csrf_valid(req,form)
 with Session() as db:
  u=auth(req,db,'settings')
  try:old=clean_path(str(form.get('old_path','')));new=clean_path(str(form.get('new_path','')))
  except UserError as e:raise HTTPException(422,str(e))
  if old==new:raise HTTPException(422,'Redirect loop')
  r=Redirect(old_path=old,new_path=new,status=301);db.add(r)
  try:db.flush()
  except IntegrityError:db.rollback();raise HTTPException(409,'Redirect already defined')
  record_audit(db,u.id,'create','redirect',r.id);db.commit();return see_also(req,'/admin/seo','Redirect created')
@app.get('/admin/mail')
def mail_admin(req:Request):
 from .db import MailConfig, EmailTemplate, EmailRule, EmailJob
 with Session() as db:
  auth(req,db,'settings')
  from .mail import bootstrap
  bootstrap(db);db.commit()
  return render_admin(req,db,'mail','SMTP & Email Notifications','settings',mail_config=db.get(MailConfig,1),email_templates=db.query(EmailTemplate).order_by(EmailTemplate.key).all(),email_rules=db.query(EmailRule).order_by(EmailRule.key).all(),email_jobs=db.query(EmailJob).order_by(EmailJob.id.desc()).limit(35).all())

@app.post('/admin/mail/config')
async def mail_config_post(req:Request):
 form=await req.form();csrf_valid(req,form)
 with Session() as db:
  user=auth(req,db,'settings')
  from .mail import save_mail_config
  try:save_mail_config(db,form)
  except ValueError as e:db.rollback();raise HTTPException(422,str(e))
  record_audit(db,user.id,'update','mail-config',1,'SMTP settings updated (password never logged)');db.commit()
 return see_also(req,'/admin/mail','SMTP configuration saved')

@app.post('/admin/mail/rules/{key}')
async def mail_rule_post(key:str,req:Request):
 form=await req.form();csrf_valid(req,form)
 with Session() as db:
  user=auth(req,db,'settings')
  from .db import EmailRule
  row=db.get(EmailRule,key)
  if not row:raise HTTPException(404)
  row.enabled=form.get('enabled')=='1'
  record_audit(db,user.id,'email-rule','mail',0,f'{key}: {row.enabled}');db.commit()
 return see_also(req,'/admin/mail','Email rule saved')

@app.post('/admin/mail/templates/{key}')
async def mail_template_post(key:str,req:Request):
 form=await req.form();csrf_valid(req,form)
 with Session() as db:
  user=auth(req,db,'settings')
  from .db import EmailTemplate
  row=db.get(EmailTemplate,key)
  if not row:raise HTTPException(404)
  subject=str(form.get('subject','')).strip()[:250]
  body=str(form.get('html','')).strip()[:20000]
  if not subject or not body:raise HTTPException(422,'Subject and body required')
  row.subject=re.sub(r'[\r\n\x00-\x1f]+',' ',subject)
  row.html=clean_html(body)
  record_audit(db,user.id,'email-template','mail',0,key);db.commit()
 return see_also(req,'/admin/mail','Email template saved')

@app.post('/admin/mail/dispatch')
async def mail_dispatch_post(req:Request):
 form=await req.form();csrf_valid(req,form)
 with Session() as db:auth(req,db,'settings')
 result=_notify_cleared_payment(0,base_url(req))
 return see_also(req,'/admin/mail',f"Mail: {result['sent']} sent, {result['failed']} failed; check outbox")

@app.get('/internal/mail/dispatch')
def mail_dispatch_cron(req:Request):
 """Optional external scheduler hook. Requires a high-entropy server-only CRON_SECRET."""
 secret=os.getenv('CRON_SECRET','')
 authorization=req.headers.get('Authorization','')
 if len(secret)<32 or not secrets.compare_digest(authorization,'Bearer '+secret):
  raise HTTPException(401,'Unauthorized')
 from .mail import dispatch
 with Session() as db:
  return JSONResponse(dispatch(db,base_url(req),limit=25),headers={'Cache-Control':'no-store'})

@app.get('/admin/audit')
def audit_list(req:Request):
 with Session() as db:
  u=auth(req,db,'settings')
  return render_admin(req,db,'audit','Audit log','settings',rows=db.query(Audit).order_by(Audit.id.desc()).limit(200).all())

@app.post('/{locale}/contact')
@app.post('/{locale}/request-quote')
async def lead_create(locale:str,req:Request):
 if locale not in ('en','id'):raise HTTPException(404)
 form=await req.form();csrf_valid(req,form)
 is_quote=req.url.path.endswith('request-quote')
 if str(form.get('website','')).strip():return RedirectResponse(f'/{locale}/'+('request-quote' if is_quote else 'contact')+'?sent=1',status_code=303)
 if form.get('consent')!='yes':raise HTTPException(422,'Consent required')
 name=str(form.get('name','')).strip()[:140];email=str(form.get('email','')).strip().lower()[:200];message=str(form.get('message','')).strip()[:6000]
 if not name or not message or not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$',email):raise HTTPException(422,'Name, message and valid email are required')
 with Session() as db:
  # DB-backed per-email throttling avoids false success and works across instances.
  recent=db.query(Lead).filter(Lead.email==email,Lead.created_at>=datetime.now(timezone.utc)-timedelta(minutes=15)).count()
  if recent>=4:raise HTTPException(429,'Too many submissions; try again later')
  lead=Lead(type='RFQ' if is_quote else 'contact',name=name,email=email,message=message,company=str(form.get('company',''))[:200],phone='',mode=str(form.get('mode',''))[:80] if is_quote else '',origin=str(form.get('origin',''))[:160] if is_quote else '',destination=str(form.get('destination',''))[:160] if is_quote else '',cargo=str(form.get('cargo',''))[:6000] if is_quote else '',pickup=str(form.get('pickup',''))[:30] if is_quote else '',source='website')
  if is_quote and (not lead.mode or not lead.origin or not lead.destination):raise HTTPException(422,'Service, origin and destination required')
  db.add(lead);db.flush();lead_code=ensure_public_code(db,lead)
  lead.reference=next_number(db,'RFQ' if is_quote else 'INQ',lead_code)
  from .db import MailConfig
  from .mail import enqueue
  conf=db.get(MailConfig,1)
  context=dict(lead_type=lead.type,lead_id=lead.reference,name=lead.name,company=lead.company,email=lead.email,
               mode=lead.mode,origin=lead.origin,destination=lead.destination,message=lead.message,
               admin_url=f'{base_url(req)}/admin/leads/{lead.id}')
  if conf and conf.enabled:
   enqueue(db,'lead_admin',conf.admin_email,context,dedupe_key=f'lead-admin-{lead.id}')
   enqueue(db,'lead_customer',lead.email,context,dedupe_key=f'lead-customer-{lead.id}')
  db.commit()
 _notify_cleared_payment(0,base_url(req))
 return RedirectResponse(f'/{locale}/'+('request-quote' if is_quote else 'contact')+'?sent=1',status_code=303)

@app.get('/{locale}/{route:path}')
def public_catchall(locale:str,route:str,req:Request):
 if locale not in ('en','id'):raise HTTPException(404)
 route='/'+route.strip('/') if route.strip('/') else '/'
 if len(route)>400 or '..' in route or '//' in route:raise HTTPException(404)
 with Session() as db:
  redirect=db.query(Redirect).filter_by(old_path='/'+locale+route).first()
  if redirect:return RedirectResponse(redirect.new_path,status_code=301)
  if route.startswith('/services/') and route.removeprefix('/services/') in SERVICE_ALIASES:
   return RedirectResponse('/'+locale+'/services/'+SERVICE_ALIASES[route.removeprefix('/services/')],status_code=301)
  return public(req,locale,route,db)
