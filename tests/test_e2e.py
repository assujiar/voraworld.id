"""Executable integration tests: SQLite persists between HTTP requests; auth, CMS, finance, PDFs & QR."""
import os, tempfile, re
from pathlib import Path
DB=tempfile.mktemp(suffix='.sqlite3',prefix='vora-test-')
# VORA_TEST_DATABASE_URL points the whole suite at a freshly migrated PostgreSQL database (see QA_REPORT.md).
os.environ['DATABASE_URL']=os.environ.get('VORA_TEST_DATABASE_URL') or 'sqlite:///'+DB
if os.environ.get('VORA_TEST_DATABASE_URL'):os.environ['VORA_SKIP_INIT_DB']='1'  # the migrations alone must produce a working app
os.environ['APP_ENV']='development'
os.environ['PUBLIC_BASE_URL']='http://testserver'
os.environ['SESSION_SECRET']='local-test-secret-that-is-long-enough-to-be-valid'
from fastapi.testclient import TestClient
from vora.main import app,password_hash
from vora.db import Session,User,Lead,Article,Invoice,Receipt,Payment,Setting,Page,Section,Verification,Nav,BankAccount,InvoiceBankInstruction


def prepare_schema():
 """SQLite tests build the schema from the models; PostgreSQL tests rely on the migrations alone."""
 from vora.db import engine,init_db
 if engine.dialect.name=='sqlite':init_db()

def csrf(client):
 if 'vora_csrf' not in client.cookies:client.get('/admin/login')
 return client.cookies['vora_csrf']

def login(client,email='owner@invalid.example',password='LocalTestPass!9'):
 r=client.post('/admin/login',data={'csrf':csrf(client),'email':email,'password':password},follow_redirects=False)
 assert r.status_code==303,r.text

def test_end_to_end(monkeypatch):
 with TestClient(app) as c:
  with Session() as db:
   db.add(User(email='owner@invalid.example',password_hash=password_hash('LocalTestPass!9'),role='superadmin'))
   db.add(User(email='viewer@invalid.example',password_hash=password_hash('viewer-pass'),role='viewer'))
   db.commit()
  for path in ['/en/','/id/','/en/about','/en/services','/en/services/sea-freight','/en/services/air-freight','/en/services/project-cargo','/en/solutions','/en/network','/en/insights','/en/faq','/en/contact','/en/request-quote']:
   r=c.get(path);assert r.status_code==200,(path,r.text[:250]);assert 'vora-primary.svg' in r.text
  assert all('href="/admin' not in c.get(route).text for route in ['/en/','/en/about','/en/contact'])
  assert c.get('/admin/settings').status_code==401
  assert c.get('/admin/invoices').status_code==401
  # Input validation + persisted RFQ
  f={'csrf':csrf(c),'name':'Sample QA','company':'Only for test','email':'qa@example.invalid','message':'Please evaluate shipment','mode':'sea-freight','origin':'Jakarta','destination':'Singapore','cargo':'12 crates','consent':'yes'}
  assert c.post('/en/request-quote',data=f,follow_redirects=False).status_code==303
  with Session() as db:
   lead=db.query(Lead).filter_by(email='qa@example.invalid').one();assert lead.type=='RFQ';lead_id=lead.id
  login(c)
  assert c.get('/admin').status_code==200
  assert c.post('/admin/navigation',data={'csrf':csrf(c),'label':'Admin','href':'/admin','position':'0'},follow_redirects=False).status_code==422
  assert c.post('/admin/navigation',data={'csrf':csrf(c),'label':'Admin','href':'/en/admin/settings','position':'0'},follow_redirects=False).status_code==422
  with Session() as db:
   db.add(Nav(label='Legacy hidden admin',href='/admin',location='header',position=0,visible=True));db.commit()
  homepage=c.get('/en/').text
  assert 'Legacy hidden admin' not in homepage and 'href="/admin' not in homepage
  assert 'href="/en/about' in homepage  # Fallback to normal navigation if only internal links were saved
  assert 'Sample QA' in c.get('/admin/leads').text
  assert c.post(f'/admin/leads/{lead_id}',data={'csrf':csrf(c),'status':'qualified','priority':'high','note':'Confirmed by QA'},follow_redirects=False).status_code==303
  with Session() as db:
   assert db.get(Lead,lead_id).status=='qualified'
  # Global settings change immediately reflected on public page
  assert c.post('/admin/settings',data={'csrf':csrf(c),'legal_name':'PT Satu Arah International','email':'contact@example.invalid','address':'QA-only address','company_description':'Test profile'},follow_redirects=False).status_code==303
  contact=c.get('/en/contact').text;assert 'QA-only address' in contact and '<label>Phone' not in contact and 'tel:' not in contact
  # HTML sanitizer + article publishing + sitemap inclusion and unpublish
  article_data={'csrf':csrf(c),'title':'Cargo Handbook for Exporters','slug':'cargo-handbook-for-exporters','locale':'en','category':'Guides','excerpt':'Freight documentation basics','body':'<h2>Checklist</h2><p>Review documents</p><script>alert(1)</script><p onclick="bad()">Safe</p>','action':'publish'}
  assert c.post('/admin/articles/new',data=article_data,follow_redirects=False).status_code==303
  with Session() as db:
   a=db.query(Article).filter_by(slug='cargo-handbook-for-exporters').one();aid=a.id;assert a.status=='published';assert '<script>' not in a.body;assert 'onclick=' not in a.body
  assert c.get('/en/insights/cargo-handbook-for-exporters').status_code==200
  assert 'cargo-handbook-for-exporters' in c.get('/sitemap.xml').text
  article_data['action']='unpublish';assert c.post(f'/admin/articles/{aid}',data=article_data,follow_redirects=False).status_code==303
  assert c.get('/en/insights/cargo-handbook-for-exporters').status_code==404
  # Visual page editor with draft/publish isolation
  form={'csrf':csrf(c),'title':'Company Values','slug':'values','locale':'en','description':'How we work','seo_title':'Our values | VORA','action':'draft'}
  assert c.post('/admin/pages/new',data=form,follow_redirects=False).status_code==303
  with Session() as db:p=db.query(Page).filter_by(slug='values').one();pid=p.id
  assert c.post(f'/admin/pages/{pid}/sections',data={'csrf':csrf(c)},follow_redirects=False).status_code==303
  with Session() as db:s=db.query(Section).filter_by(page_id=pid).first();sid=s.id
  f={'csrf':csrf(c),'title':'Care in every movement','kind':'editorial','layout':'split','body':'Details define each shipment','surface':'paper','visible':'1','button_label':'Contact','button_href':'/en/contact'}
  assert c.post(f'/admin/sections/{sid}',data=f,follow_redirects=False).status_code==303
  assert c.get('/en/values').status_code==404
  form['action']='publish';assert c.post(f'/admin/pages/{pid}',data=form,follow_redirects=False).status_code==303
  assert 'Care in every movement' in c.get('/en/values').text
  # Customer + 2 line invoice + decimal-safe tax calculation
  customer_form={'csrf':csrf(c),'name':'QA SHIPPING TEST CUSTOMER','email':'client@example.invalid','currency':'IDR','terms_days':'14','address':'Test Street'}
  assert c.post('/admin/customers/new',data=customer_form,follow_redirects=False).status_code==303
  with Session() as db:customer_id=db.query(__import__('vora.db',fromlist=['Customer']).Customer).filter_by(name='QA SHIPPING TEST CUSTOMER').one().id
  # Multiple bank accounts are editable through finance-only admin master data.
  for bank_name,number,default in [('Test Bank Alpha','111222333','1'),('Test Bank Beta','999888777','0')]:
   assert c.post('/admin/bank-accounts',data={'csrf':csrf(c),'bank_name':bank_name,'account_number':number,'account_holder':'PT Satu Arah International','currency':'IDR','is_default':default},follow_redirects=False).status_code==303
  with Session() as db:
   banks=db.query(BankAccount).order_by(BankAccount.id).all();assert len(banks)==2
   bank_ids=[str(b.id) for b in banks]
  assert 'Test Bank Alpha' in c.get('/admin/bank-accounts').text
  inv_form={'csrf':csrf(c),'customer_id':str(customer_id),'issued_at':'2026-10-29','due_at':'2026-11-12','tax_percent':'11','withholding_percent':'2','discount':'50000','po_number':'QA-PO-184','shipment_reference':'DOJKUG26090001','bank_account_ids':bank_ids,'notes':'Integration only','items':'Freight | 1 | 2000000 | job\nDocumentation | 2 | 250000 | item'}
  assert c.post('/admin/invoices/new',data=inv_form,follow_redirects=False).status_code==303
  with Session() as db:
   inv=db.query(Invoice).order_by(Invoice.id.desc()).first();iid=inv.id;assert inv.subtotal_minor==2_500_000;assert inv.total_minor==2_670_500;assert inv.status=='draft';token=db.query(Verification).filter_by(kind='invoice',document_id=iid).one().token
  public_verification=c.get(f'/verify/{token}')
  assert public_verification.status_code==200
  assert 'electronic signature or tax certificate' not in public_verification.text
  invoice_pdf=c.get(f'/admin/invoices/{iid}/pdf')
  assert invoice_pdf.content[:4]==b'%PDF'
  from pypdf import PdfReader
  import io
  invoice_text=' '.join((page.extract_text() or '') for page in PdfReader(io.BytesIO(invoice_pdf.content)).pages)
  assert 'Digital verification is not' not in invoice_text
  assert 'tax invoice' not in invoice_text.lower()
  assert 'QA-PO-184' in invoice_text and 'DOJKUG26090001' in invoice_text
  assert 'Test Bank Alpha' in invoice_text and 'Test Bank Beta' in invoice_text
  assert '111222333' in invoice_text and '999888777' in invoice_text
  assert 'PAYMENT INSTRUCTIONS' in invoice_text
  with Session() as db:
   ins=db.query(InvoiceBankInstruction).filter_by(invoice_id=iid).all()
   assert len(ins)==2
  # Changing bank master cannot alter historical invoice snapshots.
  assert c.post(f'/admin/bank-accounts/{bank_ids[0]}',data={'csrf':csrf(c),'action':'save','bank_name':'Test Bank Alpha','account_number':'111000111','account_holder':'PT Satu Arah International'},follow_redirects=False).status_code==303
  assert '111222333' in ' '.join(page.extract_text() or '' for page in PdfReader(io.BytesIO(c.get(f'/admin/invoices/{iid}/pdf').content)).pages)
  assert '111000111' not in ' '.join(page.extract_text() or '' for page in PdfReader(io.BytesIO(c.get(f'/admin/invoices/{iid}/pdf').content)).pages)
  assert c.post(f'/admin/invoices/{iid}/status',data={'csrf':csrf(c),'action':'issue'},follow_redirects=False).status_code==303
  # Configure custom SMTP and trigger rules through real Admin forms. Fake the
  # external SMTP network only, so actual queue/dispatch code executes.
  delivered=[]
  monkeypatch.setattr('vora.mail.send_smtp',lambda conf,to,subject,body,attachment=None: delivered.append((to,subject,body,attachment)))
  assert c.get('/admin/mail').status_code==200
  assert c.post('/admin/mail/config',data={'csrf':csrf(c),'host':'smtp.example.invalid','port':'587','security':'starttls','from_email':'info@voraworld.id','reply_to':'info@voraworld.id','admin_email':'info@voraworld.id','enabled':'1'},follow_redirects=False).status_code==303
  for event in ('payment_confirmed','receipt_customer'):
   assert c.post(f'/admin/mail/rules/{event}',data={'csrf':csrf(c),'enabled':'1'},follow_redirects=False).status_code==303
  assert c.post(f'/admin/invoices/{iid}/payment',data={'csrf':csrf(c),'amount':'500000','date':'2026-10-29','method':'bank transfer','reference':'QA-TRX','receiving_bank_id':bank_ids[1]},follow_redirects=False).status_code==303
  with Session() as db:
   inv=db.get(Invoice,iid);assert inv.outstanding_minor==2_670_500 and inv.status=='issued'
   p=db.query(Payment).one();pid=p.id;assert p.status=='pending_confirmation'
   assert db.query(Receipt).count()==0
  assert 'Confirm cleared funds' in c.get(f'/admin/invoices/{iid}').text
  assert c.post(f'/admin/payments/{pid}/confirm',data={'csrf':csrf(c)},follow_redirects=False).status_code==422
  assert c.post(f'/admin/payments/{pid}/confirm',data={'csrf':csrf(c),'funds_cleared':'yes'},follow_redirects=False).status_code==303
  assert c.post(f'/admin/payments/{pid}/confirm',data={'csrf':csrf(c),'funds_cleared':'yes'},follow_redirects=False).status_code==409
  with Session() as db:
   inv=db.get(Invoice,iid);assert inv.outstanding_minor==2_170_500;assert inv.status=='partially_paid';receipt=db.query(Receipt).one();rid=receipt.id;receipt_token=db.query(Verification).filter_by(kind='receipt',document_id=rid).one().token
   p=db.get(Payment,pid);assert p.status=='recorded' and p.confirmed_by is not None
  assert 'PARTIALLY PAID' in c.get(f'/verify/{token}').text
  from vora.db import EmailJob
  with Session() as db:
   jobs=db.query(EmailJob).order_by(EmailJob.id).all()
   assert len(jobs)==2 and all(j.status=='sent' for j in jobs)
   assert all(j.attempts==1 for j in jobs)
  assert len(delivered)==2
  assert all(d[0]=='client@example.invalid' for d in delivered)
  assert any('PARTIALLY PAID' in d[2] and 'credited' in d[2] for d in delivered)
  assert len([d for d in delivered if d[3] is not None and d[3][1].startswith(b'%PDF')])==1
  # An unconfirmed payment is cancelable, and cannot trigger any customer email.
  assert c.post(f'/admin/invoices/{iid}/payment',data={'csrf':csrf(c),'amount':'150000','date':'2026-10-29','method':'bank transfer','receiving_bank_id':bank_ids[1]},follow_redirects=False).status_code==303
  with Session() as db:
   unconfirmed=db.query(Payment).order_by(Payment.id.desc()).first().id
  assert c.post(f'/admin/payments/{unconfirmed}/cancel',data={'csrf':csrf(c)},follow_redirects=False).status_code==303
  with Session() as db:
   assert db.get(Invoice,iid).outstanding_minor==2_170_500
   assert db.get(Payment,unconfirmed).status=='cancelled'
   assert db.query(EmailJob).count()==2

  receipt_pdf=c.get(f'/admin/receipts/{rid}/pdf')
  assert receipt_pdf.content[:4]==b'%PDF'
  receipt_text=' '.join(page.extract_text() or '' for page in PdfReader(io.BytesIO(receipt_pdf.content)).pages)
  assert 'Test Bank Beta' in receipt_text and '999888777' in receipt_text
  assert 'AMOUNT RECEIVED' in receipt_text
  assert 'AUTHENTIC' in c.get(f'/verify/{receipt_token}').text
  # No overpayment
  r=c.post(f'/admin/invoices/{iid}/payment',data={'csrf':csrf(c),'amount':'3000000','date':'2026-10-29'},follow_redirects=False)
  assert r.status_code==422
  assert c.post(f'/admin/receipts/{rid}/void',data={'csrf':csrf(c)},follow_redirects=False).status_code==303
  assert 'VOID' in c.get(f'/verify/{receipt_token}').text
  with Session() as db:
   assert db.get(Invoice,iid).outstanding_minor==2_670_500
   assert db.get(Payment,1).status=='void'
  # Minimum privacy and RBAC
  assert c.get('/verify/not-a-real-token').status_code==404
  assert 'QA SHIPPING TEST CUSTOMER' not in c.get(f'/verify/{token}').text
  assert c.get('/en/no-such-route').status_code==404
  assert '/admin' in c.get('/robots.txt').text
  c.get('/admin/logout')
  login(c,'viewer@invalid.example','viewer-pass')
  assert c.get('/admin/leads').status_code==403
  assert c.get('/admin/invoices').status_code==403
  assert c.get('/admin/bank-accounts').status_code==403
  assert c.post('/admin/bank-accounts',data={'csrf':csrf(c),'bank_name':'ATTACK','account_number':'12345678','account_holder':'X','currency':'IDR'},follow_redirects=False).status_code==403
  assert c.post('/admin/settings',data={'csrf':csrf(c),'email':'hacked@invalid.example'},follow_redirects=False).status_code==403
  # Real media upload + public file persistence. Viewer cannot upload.
  from PIL import Image
  import io
  pic=io.BytesIO();Image.new('RGBA',(24,24),(180,62,49,255)).save(pic,format='PNG')
  upload={'image':('test-qa-only.png',pic.getvalue(),'image/png')}
  assert c.post('/admin/media',data={'csrf':csrf(c),'alt':'QA sample'},files=upload,follow_redirects=False).status_code==403
  c.get('/admin/logout');login(c)
  assert c.post('/admin/media',data={'csrf':csrf(c),'alt':'QA sample image'},files=upload,follow_redirects=False).status_code==303
  from vora.db import Media
  with Session() as db:m=db.query(Media).one();url=m.url
  assert url.startswith('/uploads/') and c.get(url).status_code==200
  # Tampered CSRF must not mutate data
  assert c.post('/admin/settings',data={'csrf':'malformed','email':'tampered@invalid.example'},follow_redirects=False).status_code==403
  with Session() as db:assert db.get(Setting,'email').value=='contact@example.invalid'


def test_money_math():
 from vora.logic import units,calc_lines
 assert units('12.35','USD')==1235
 assert units('12.5','IDR')==13
 assert calc_lines([{'description':'test','quantity':'1.5','price':'100','unit':'ea'}],'USD',tax='11')['total_minor']==16650


def test_document_numbering_and_quotation(monkeypatch):
 """Shared client code, random tail, collision retry, PDF + token, stable code."""
 from vora.db import Customer, Quotation
 from vora import logic
 pattern=lambda kind,code,date:rf'{kind}-VORA-{code}-{date}-\d{{5}}'
 with TestClient(app) as c:
  login(c)
  with Session() as db:
   customer=db.query(Customer).filter_by(name='QA SHIPPING TEST CUSTOMER').one()
   code=customer.public_code
   assert re.fullmatch(r'C[A-F0-9]{10}',code)
   inv=db.query(Invoice).filter_by(customer_id=customer.id).first()
   assert re.fullmatch(pattern('INV',code,'202610'),inv.number)
   receipt=db.query(Receipt).filter_by(invoice_id=inv.id).one()
   assert re.fullmatch(pattern('RCP',code,'202610'),receipt.number)
   lead=db.query(Lead).filter_by(email='qa@example.invalid').one()
   assert re.fullmatch(r'L[A-F0-9]{10}',lead.public_code)
   assert re.fullmatch(pattern('RFQ',lead.public_code,'202610'),lead.reference)
   cust_id=customer.id
  payload={'csrf':csrf(c),'recipient':f'customer:{cust_id}','issued_at':'2026-10-29','valid_until':'2026-12-31','tax_percent':'0','items':'Freight service | 1 | 3500000 | shipment','notes':'Valid offer'}
  assert c.get('/admin/quotations/new').status_code==200
  assert c.post('/admin/quotations/new',data=payload,follow_redirects=False).status_code==303
  with Session() as db:
   a=db.query(Quotation).order_by(Quotation.id.desc()).first()
   assert re.fullmatch(pattern('QUO',code,'202610'),a.number)
   qid=a.id;token=db.query(Verification).filter_by(kind='quotation',document_id=qid).one().token
  assert 'DRAFT' in c.get(f'/verify/{token}').text
  data=c.get(f'/admin/quotations/{qid}/pdf').content
  assert data[:4]==b'%PDF'
  from pypdf import PdfReader
  assert 'QUO-VORA-' in PdfReader(__import__('io').BytesIO(data)).pages[0].extract_text()
  assert c.post(f'/admin/quotations/{qid}/status',data={'csrf':csrf(c),'action':'issue'},follow_redirects=False).status_code==303
  assert 'AUTHENTIC' in c.get(f'/verify/{token}').text
  assert c.post(f'/admin/quotations/{qid}/status',data={'csrf':csrf(c),'action':'void'},follow_redirects=False).status_code==303
  assert 'VOID' in c.get(f'/verify/{token}').text
  # Quotation to a lead receives that lead's stable L-code, not customer code
  with Session() as db:
   lead_id=db.query(Lead).filter_by(email='qa@example.invalid').one().id
   lead_code=db.get(Lead,lead_id).public_code
  payload['recipient']=f'lead:{lead_id}'
  assert c.post('/admin/quotations/new',data=payload,follow_redirects=False).status_code==303
  with Session() as db:
   q=db.query(Quotation).order_by(Quotation.id.desc()).first()
   assert re.fullmatch(pattern('QUO',lead_code,'202610'),q.number)
  # Force collision for 5-digit suffix and confirm next random draw is retried.
  existing_numbers=[]
  with Session() as db:
   from vora.logic import next_number
   # Two separate transactions reserve and commit distinct quotation numbers
   seq=iter([43210,43210,98765])
   monkeypatch.setattr(logic.secrets,'randbelow',lambda n:next(seq))
   first=next_number(db,'QUO',code,'2026-11-01')
   obj=Quotation(number=first,customer_id=cust_id,issued_at='2026-11-01',valid_until='2026-11-30')
   db.add(obj);db.commit()
  with Session() as db:
   second=next_number(db,'QUO',code,'2026-11-01')
   assert first.endswith('43210') and second.endswith('98765')
  with Session() as db:
   customer=db.get(Customer,cust_id);assert customer.public_code==code
