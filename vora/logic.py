import os, re, secrets, hashlib, hmac, io, json, mimetypes, urllib.request
from decimal import Decimal, ROUND_HALF_UP, InvalidOperation
from datetime import date, datetime, timezone
import bleach, qrcode
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor
from sqlalchemy import select
from .db import Counter, Invoice, InvoiceItem, Payment, Receipt, Quotation, Verification, Audit, Setting, now

ALLOWED_TAGS=['p','br','strong','b','i','em','u','s','h2','h3','h4','h5','h6','ul','ol','li','a','blockquote','pre','code','table','thead','tbody','tr','th','td','figure','figcaption','img','hr']
ALLOWED_ATTRIBUTES={'a':['href','title','target','rel'],'img':['src','alt','title','width','height'],'th':['colspan','rowspan'],'td':['colspan','rowspan']}
def attr_filter(tag,name,value):
 if name not in ALLOWED_ATTRIBUTES.get(tag,[]):return False
 if name in ('href','src') and not (value.startswith('https://') or value.startswith('mailto:') or value.startswith('/') and not value.startswith('//')):return False
 return True
def clean_html(html):
 safe=bleach.clean(html or '',tags=ALLOWED_TAGS,attributes=attr_filter,protocols=['http','https','mailto'],strip=True)
 return safe.replace('target="_blank"','target="_blank" rel="noopener noreferrer"')
def slugify(x):return re.sub('-+','-',re.sub('[^a-z0-9-]','-',x.lower())).strip('-')[:160]
def minor_decimals(currency):return 0 if currency in ('IDR','JPY','KRW') else 2
def units(value,currency='IDR'):
 try:d=Decimal(str(value).strip())
 except InvalidOperation:raise ValueError('Invalid monetary value')
 if not d.is_finite():raise ValueError('Non-finite money')
 return int((d*(Decimal(10)**minor_decimals(currency))).quantize(Decimal('1'),rounding=ROUND_HALF_UP))
def money(v,currency='IDR'):
 d=Decimal(int(v))/(Decimal(10)**minor_decimals(currency));return f'{currency} {d:,.{minor_decimals(currency)}f}'
def calc_lines(lines,currency,tax='0',withholding='0',discount_minor=0):
 out=[];subtotal=0
 for line in lines:
  qty=Decimal(str(line['quantity']));price=units(line['price'],currency)
  if qty<=0 or price<0 or qty>1000000:raise ValueError('Invalid quantity or price')
  amt=int((qty*price).quantize(Decimal('1'),rounding=ROUND_HALF_UP));subtotal+=amt
  out.append(dict(description=str(line['description'])[:500],unit=str(line.get('unit','unit'))[:30],quantity=str(qty),price_minor=price,amount_minor=amt))
 net=subtotal-int(discount_minor)
 if net<0:raise ValueError('Discount exceeds subtotal')
 t=Decimal(str(tax));w=Decimal(str(withholding))
 if t<0 or t>100 or w<0 or w>100:raise ValueError('Tax percentage out of range')
 tax_minor=int((Decimal(net)*t/100).quantize(Decimal('1'),rounding=ROUND_HALF_UP))
 withholding_minor=int((Decimal(net)*w/100).quantize(Decimal('1'),rounding=ROUND_HALF_UP))
 total=net+tax_minor-withholding_minor
 if total<0:raise ValueError('Negative invoice')
 return dict(items=out,subtotal_minor=subtotal,tax_minor=tax_minor,withholding_minor=withholding_minor,total_minor=total)
def ensure_public_code(db, entity):
 """Stable per-customer/lead reference, never derived from name or email."""
 from .db import Customer, Lead
 if not isinstance(entity,(Customer,Lead)):raise ValueError('Owner must be a customer or lead')
 if entity.public_code:return entity.public_code
 prefix='C' if isinstance(entity,Customer) else 'L'
 owner_type=Customer if prefix=='C' else Lead
 for _ in range(60):
  candidate=prefix+secrets.token_hex(5).upper() # 11 chars, stable for future docs
  if db.query(owner_type.id).filter_by(public_code=candidate).first() is None:
   entity.public_code=candidate;db.flush();return candidate
 raise ValueError('Cannot allocate a unique owner code')

def next_number(db,kind,owner_code,date_string=None):
 """KIND-VORA-OWNER-YYYYMM-RANDOM5, locked per owner, kind and month.

 The final five digits are RANDOM, not a predictable running counter. A DB unique
 constraint remains the ultimate safeguard against duplicates.
 """
 from .db import Lead, Quotation
 from datetime import date as date_type
 from sqlalchemy import text
 kind=kind.upper()
 if not re.fullmatch(r'[A-Z]{3}',kind):raise ValueError('Invalid document kind')
 if not re.fullmatch(r'[CL][A-F0-9]{10}',owner_code or ''):raise ValueError('Invalid owner code')
 period=date_type.fromisoformat(date_string or date_type.today().isoformat()).strftime('%Y%m')
 scope=f'{kind}-VORA-{owner_code}-{period}-'
 if db.bind.dialect.name=='postgresql':
  db.execute(text('SELECT pg_advisory_xact_lock(hashtext(:scope))'),{'scope':scope})
 models={'INV':Invoice,'RCP':Receipt,'QUO':Quotation,'RFQ':Lead,'INQ':Lead}
 model=models.get(kind)
 if model is None:raise ValueError('Unsupported document kind')
 field=Lead.reference if kind in ('RFQ','INQ') else model.number
 # Uniform distribution over 00000..99999. Limited namespace; fail explicitly
 # rather than silently reuse a number when saturated.
 for _ in range(160):
  candidate=scope+f'{secrets.randbelow(100000):05d}'
  if db.execute(select(field).where(field==candidate)).first() is None:
   return candidate
 raise ValueError('Could not allocate a unique five-digit document number')

def create_verification(db,kind,document_id):
 raw=secrets.token_urlsafe(36)
 db.add(Verification(token=raw,token_hash=hashlib.sha256(raw.encode()).hexdigest(),kind=kind,document_id=document_id))
 return raw
def get_verification(db,kind,doc_id):return db.query(Verification).filter_by(kind=kind,document_id=doc_id).first()
def record_audit(db,uid,verb,kind,oid,summary=''):
 db.add(Audit(actor_id=uid,verb=verb,object_type=kind,object_id=oid,summary=str(summary)[:1000]))
def recompute_outstanding(db,invoice):
 paid=sum(p.amount_minor for p in db.query(Payment).filter_by(invoice_id=invoice.id,status='recorded').all())
 if paid>invoice.total_minor:raise ValueError('Payments exceed invoice total')
 invoice.outstanding_minor=invoice.total_minor-paid
 if invoice.status!='void':invoice.status='paid' if not invoice.outstanding_minor else ('partially_paid' if paid else 'issued')
 return invoice.outstanding_minor

def payment_record(db,invoice,amount_str,date_str,method='',reference=''):
 """Record a payment claim, NOT confirmation of credited funds.

 An invoice must remain issued/partially_paid until Finance confirms actual
 funds. Pending claims reserve remaining balance to prevent competing claims.
 """
 invoice=db.execute(select(Invoice).where(Invoice.id==invoice.id).with_for_update()).scalar_one()
 if invoice.status in ('void','draft','paid'):raise ValueError('Invoice must be issued and have unpaid balance')
 remaining=recompute_outstanding(db,invoice)
 reserved=sum(p.amount_minor for p in db.query(Payment).filter_by(invoice_id=invoice.id,status='pending_confirmation').all())
 amount=units(amount_str,invoice.currency)
 if amount<=0 or amount>remaining-reserved:raise ValueError('Payment amount exceeds unreserved outstanding balance')
 if date_str:
  date.fromisoformat(date_str)
 p=Payment(invoice_id=invoice.id,amount_minor=amount,date=date_str or date.today().isoformat(),method=method or 'bank transfer',reference=reference,status='pending_confirmation')
 db.add(p);db.flush()
 return p

def pdf_document(db,kind,doc_id,base_url):
 if kind=='quotation':
  doc=db.get(Quotation,doc_id)
  if not doc:raise ValueError('Missing quotation')
  number=doc.number;status=doc.status;date_str=doc.issued_at;inv=doc
 elif kind=='invoice':
  doc=db.get(Invoice,doc_id)
  if not doc:raise ValueError('Missing invoice')
  number=doc.number;status=doc.status;date_str=doc.issued_at;inv=doc
 else:
  doc=db.get(Receipt,doc_id)
  if not doc:raise ValueError('Missing receipt')
  number=doc.number;status=doc.status;date_str=doc.created_at.date().isoformat();inv=db.get(Invoice,doc.invoice_id)
  if doc.stamp_required and doc.status=='issued':
   from .receipt_stamp import final_receipt_pdf
   return final_receipt_pdf(doc)
 ver=get_verification(db,kind,doc_id)
 if ver is None:raise ValueError('Document has no verification token')
 url=f'{base_url.rstrip("/")}/verify/{ver.token}'
 from .pdf_design import render_pdf
 return render_pdf(db,kind,doc,base_url,url,money)

 settings={x.key:x.value for x in db.query(Setting).all()}
 buffer=io.BytesIO();pdf=canvas.Canvas(buffer,pagesize=A4,pageCompression=1);W,H=A4
 pdf.setTitle(number);pdf.setAuthor('VORA | PT Satu Arah International')
 # Official A icon, raster derivative of brand-kit SVG. Low opacity; no redrawing.
 from pathlib import Path
 from reportlab.lib.utils import ImageReader
 icon=Path(__file__).resolve().parent/'static'/'assets'/'vora-a-watermark.png'
 def draw_watermark():
  if icon.exists():
   pdf.saveState();pdf.drawImage(ImageReader(str(icon)),W/2-205,H/2-115,width=410,height=230,mask='auto');pdf.restoreState()
 draw_watermark()
 pdf.setFillColor(HexColor('#101720'));pdf.rect(0,H-140,W,140,stroke=0,fill=1)
 pdf.setFillColor(HexColor('#FFFFFF'));
 from reportlab.lib.utils import ImageReader
 from pathlib import Path
 logo=Path(__file__).resolve().parent/'static'/'assets'/'vora-reverse.png'
 pdf.drawImage(ImageReader(str(logo)),46,H-87,width=160,height=35,mask='auto')
 pdf.setFont('Helvetica',10);pdf.drawString(46,H-110,settings.get('legal_name','PT Satu Arah International'))
 pdf.drawRightString(W-45,H-66,kind.upper());pdf.drawRightString(W-45,H-87,number)
 pdf.setFillColor(HexColor('#101720'));pdf.setFont('Helvetica',10)
 y=H-176
 # Contact details use saved company settings, not hard-coded invoice text.
 from reportlab.lib.utils import simpleSplit
 for label,key in [('Email','email'),('Office','address')]:
  value=settings.get(key,'')
  if value:
   pdf.setFont('Helvetica',9)
   for line in simpleSplit(f'{label}: {value}', 'Helvetica', 9, W-92):
    pdf.drawString(46,y,line);y-=15
 if settings.get('email') or settings.get('address'): y-=9
 pdf.setFont('Helvetica',10)
 for l in [f'Date: {date_str}',f'Status: {status.upper()}',f'Customer: {inv.customer.name if inv.customer else inv.lead.company or inv.lead.name}',f'Currency: {inv.currency}'] + ([f'Valid until: {inv.valid_until}'] if kind=='quotation' else []):
  pdf.drawString(46,y,l);y-=19
 if kind in ('invoice','quotation'):
  y-=18;pdf.setFont('Helvetica-Bold',11);pdf.drawString(46,y,'DESCRIPTION');pdf.drawRightString(W-46,y,'AMOUNT');y-=18
  pdf.setFont('Helvetica',10)
  for item in inv.items:
   if y<140:pdf.showPage();draw_watermark();y=H-70
   pdf.drawString(46,y,item.description[:70]);pdf.drawRightString(W-46,y,money(item.amount_minor,inv.currency));y-=20
  y-=16
  amounts=[('Subtotal',inv.subtotal_minor)]
  if kind=='invoice':amounts.extend([('Discount',-inv.discount_minor),('Tax',inv.tax_minor),('Withholding',-inv.withholding_minor),('TOTAL',inv.total_minor),('Outstanding',inv.outstanding_minor)])
  else:amounts.extend([('Tax',inv.tax_minor),('TOTAL',inv.total_minor)])
  for label,value in amounts:
   pdf.setFont('Helvetica-Bold' if label in ('TOTAL','Outstanding') else 'Helvetica',10)
   pdf.drawString(300,y,label);pdf.drawRightString(W-46,y,money(value,inv.currency));y-=18
 else:
  payment=db.get(Payment,doc.payment_id)
  y-=20;pdf.setFont('Helvetica-Bold',17);pdf.drawString(46,y,money(payment.amount_minor,inv.currency));y-=28
  pdf.setFont('Helvetica',10)
  for item in [f'Payment for invoice: {inv.number}',f'Payment date: {payment.date}',f'Method: {payment.method}',f'Reference: {payment.reference or "N/A"}']:
   pdf.drawString(46,y,item[:95]);y-=21
 y=min(y-40,170)
 qr=qrcode.make(url);from reportlab.lib.utils import ImageReader
 pdf.drawImage(ImageReader(qr.get_image().convert('RGB')),W-147,35,width=102,height=102)
 pdf.setFont('Helvetica',8);pdf.drawString(46,97,'Scan the QR code to verify document authenticity.')
 pdf.drawString(46,82,'Verify document status via the QR code or VORA website.')
 if kind=='receipt' and doc.stamp_required:
  pdf.setFont('Helvetica-Bold',8);pdf.drawString(46,114,'E-METERAI REQUIRED - APPLY OFFICIALLY BEFORE RELEASE')
 pdf.drawString(46,48,settings.get('email','')[:65]);pdf.save();return buffer.getvalue()
