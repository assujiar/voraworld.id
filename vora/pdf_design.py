"""VORA premium editorial-monospace A4 business documents.
Official SVG-derived artwork only. Currency arithmetic is owned by logic.py.
Verification QR is a lookup token, not a standalone signature or payment QR.
"""
from __future__ import annotations
import io
from pathlib import Path
import qrcode
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader
from .db import Invoice, Quotation, Receipt, Payment, Setting

INK='#101720'; RED='#B43E31'; SLATE='#64717C'; PAPER='#F7F7F4'; RULE='#DCE0E1'; WHITE='#FFFFFF'
W,H=A4; LEFT=45; RIGHT=W-45; WIDTH=RIGHT-LEFT
LOGO=Path(__file__).parent/'static/assets/vora-reverse.png'
WATERMARK=Path(__file__).parent/'static/assets/vora-a-watermark.png'

def _text(c,x,y,text,size=9,color=INK,bold=False):
 c.setFillColor(HexColor(color));c.setFont('Courier-Bold' if bold else 'Courier',size)
 c.drawString(x,y,str(text));return y

def _right(c,x,y,text,size=9,color=INK,bold=False):
 c.setFillColor(HexColor(color));c.setFont('Courier-Bold' if bold else 'Courier',size)
 c.drawRightString(x,y,str(text));return y

def _wrap(text,columns=66):
 import textwrap
 text=str(text or '').replace('\r','')
 return [line for paragraph in text.split('\n') for line in (textwrap.wrap(paragraph,width=columns,break_long_words=True,break_on_hyphens=False) or [''])]

def _line(c,y,color=RULE):
 c.setStrokeColor(HexColor(color));c.setLineWidth(.7);c.line(LEFT,y,RIGHT,y)

def render_pdf(db,kind,document,base_url,verification_url,money):
 """Generate branded documents; invoice pages hold at most five line items."""
 if kind=='invoice':
  from .pdf_invoice import render_invoice
  return render_invoice(db,document,verification_url,money)
 if kind=='receipt':
  from .pdf_receipt import render_receipt
  return render_receipt(db,document,verification_url,money)
 if kind=='quotation' and len(document.items)<=10:
  from .pdf_compact import render_compact_document
  return render_compact_document(db,kind,document,verification_url,money)
 settings={r.key:r.value for r in db.query(Setting).all()}
 inv=document if kind=='invoice' else db.get(Invoice,document.invoice_id) if kind=='receipt' else document
 customer=inv.customer if inv.customer else inv.lead
 recipient_name=getattr(customer,'name','') if inv.customer else (inv.lead.company or inv.lead.name)
 recipient_address=getattr(customer,'address','')
 recipient_email=getattr(customer,'email','')
 recipient_tax=getattr(customer,'tax_id','')
 payment=db.get(Payment,document.payment_id) if kind=='receipt' else None
 buffer=io.BytesIO();c=canvas.Canvas(buffer,pagesize=A4,pageCompression=1)
 c.setTitle(f'{kind.upper()} | {document.number}')
 c.setAuthor('VORA | PT Satu Arah International')
 c.setSubject('VORA business document')
 pages=[0]
 def header(page):
  pages[0]=page
  c.setFillColor(HexColor(WHITE));c.rect(0,0,W,H,stroke=0,fill=1)
  if WATERMARK.exists():
   c.drawImage(ImageReader(str(WATERMARK)),W/2-185,H/2-104,width=370,height=208,mask='auto')
  c.setFillColor(HexColor(INK));c.rect(0,H-122,W,122,stroke=0,fill=1)
  c.setFillColor(HexColor(RED));c.rect(0,H-126,W,4,stroke=0,fill=1)
  if LOGO.exists():c.drawImage(ImageReader(str(LOGO)),LEFT,H-80,width=143,height=31,mask='auto')
  _text(c,LEFT,H-106,'FREIGHT & LOGISTICS',8.2,WHITE)
  _right(c,RIGHT,H-56,kind.upper(),18,WHITE,True)
  _right(c,RIGHT,H-78,document.number,7.0,WHITE)
  _right(c,RIGHT,H-104,document.status.upper(),8,'#E8B3AA',True)
  # clean footer with official QR on every page
  _line(c,83)
  _text(c,LEFT,68,'VORA / DOCUMENT AUTHENTICATION',8,SLATE,True)
  _text(c,LEFT,54,'Scan QR to check number and current status.',7.4,SLATE)
  _text(c,LEFT,39,settings.get('email','info@voraworld.id'),7.6,INK)
  _text(c,LEFT,24,f'{kind.upper()} - PAGE {page}',7.3,SLATE)
  try:
   qr=qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M,box_size=3,border=1)
   qr.add_data(verification_url);qr.make(fit=True)
   c.drawImage(ImageReader(qr.make_image(fill_color=INK,back_color='white').convert('RGB')),RIGHT-76,9,72,72,mask='auto',preserveAspectRatio=False)
  except Exception:raise
 def next_page():
  c.showPage();header(pages[0]+1);return H-160
 def ensure(y,needed):
  return next_page() if y-needed<105 else y
 def section(caption,y):
  y=ensure(y,33)
  _text(c,LEFT,y,caption.upper(),8.1,RED,True)
  _line(c,y-9)
  return y-26
 def kv(label,value,y,x=LEFT,max_cols=49):
  lines=_wrap(value,max_cols)
  y=ensure(y,16+len(lines)*11)
  _text(c,x,y,label.upper(),7.6,SLATE)
  y-=15
  for line in lines:
   _text(c,x,y,line,8.2,INK,False);y-=11.8
  return y-7

 header(1)
 y=H-158
 # Issuer and recipient are arranged in editorial two-column layout.
 _text(c,LEFT,y,'ISSUED BY',8.2,RED,True)
 _text(c,LEFT+259,y,'BILL TO / RECEIVED FROM',8.2,RED,True)
 y-=18
 legal=settings.get('legal_name') or 'PT Satu Arah International'
 for i,line in enumerate(_wrap(legal,40)[:2]):_text(c,LEFT,y-i*12,line,8.7,INK,True)
 for i,line in enumerate(_wrap(recipient_name,38)[:2]):_text(c,LEFT+259,y-i*12,line,8.7,INK,True)
 y-=34
 issuer_lines=_wrap(settings.get('address',''),40)[:4]
 customer_lines=_wrap(recipient_address,38)[:4]
 for i,line in enumerate(issuer_lines):_text(c,LEFT,y-i*12,line,8,SLATE)
 for i,line in enumerate(customer_lines):_text(c,LEFT+259,y-i*12,line,8,SLATE)
 y-=max(len(issuer_lines),len(customer_lines),1)*12+9
 if settings.get('email'):_text(c,LEFT,y,settings['email'][:41],7.7,SLATE)
 if recipient_email:_text(c,LEFT+259,y,recipient_email[:37],7.7,SLATE)
 y-=18
 if recipient_tax:_text(c,LEFT+259,y,'TAX ID: '+str(recipient_tax)[:30],7.6,SLATE);y-=15
 _line(c,y);y-=29
 # Document metadata strip (two columns)
 _text(c,LEFT,y,'DOCUMENT DATE',7.6,SLATE);_text(c,LEFT+259,y,'CURRENCY',7.6,SLATE)
 y-=17
 issued=document.issued_at if kind in ('invoice','quotation') else payment.date
 _text(c,LEFT,y,issued,9.5,INK,True);_text(c,LEFT+259,y,inv.currency,9.5,INK,True)
 y-=25
 if kind=='invoice':
  _text(c,LEFT,y,'DUE DATE',7.6,SLATE);_text(c,LEFT+259,y,'DOCUMENT STATUS',7.6,SLATE);y-=16
  _text(c,LEFT,y,document.due_at,9.2,INK,True);_text(c,LEFT+259,y,document.status.upper(),9.2,INK,True);y-=24
  if document.po_number or document.shipment_reference:
   if document.po_number:y=kv('Purchase order',document.po_number,y)
   if document.shipment_reference:y=kv('Shipment / job reference',document.shipment_reference,y)
 elif kind=='quotation':
  _text(c,LEFT,y,'VALID UNTIL',7.6,SLATE);_text(c,LEFT+259,y,'OFFER STATUS',7.6,SLATE);y-=16
  _text(c,LEFT,y,document.valid_until,9.2,INK,True);_text(c,LEFT+259,y,document.status.upper(),9.2,INK,True);y-=24
 else:
  _text(c,LEFT,y,'RELATED INVOICE',7.6,SLATE);y-=16
  _text(c,LEFT,y,inv.number,7.7,INK,True);y-=26
 if kind in ('invoice','quotation'):
  y=section('Description of services',y)
  # Full multi-item pricing (unit, qty, rate and total) in a stable grid.
  def columns(y):
   c.setFillColor(HexColor(PAPER));c.roundRect(LEFT,y-12,WIDTH,24,5,stroke=0,fill=1)
   _text(c,LEFT+9,y-4,'ITEM / DESCRIPTION',7.1,SLATE,True)
   _right(c,LEFT+328,y-4,'QTY',7.1,SLATE,True)
   _right(c,LEFT+385,y-4,'UNIT',7.1,SLATE,True)
   _right(c,LEFT+455,y-4,'RATE',7.1,SLATE,True)
   _right(c,RIGHT-7,y-4,'TOTAL',7.1,SLATE,True)
   return y-31
  y=ensure(y,63);y=columns(y)
  for idx,item in enumerate(document.items,1):
   lines=_wrap(f'{idx:02d}  {item.description}',36)
   row_height=max(26,14*len(lines)+12)
   old_page=pages[0];y=ensure(y,row_height)
   if pages[0]!=old_page:y=columns(y)
   _line(c,y+10)
   for i,line in enumerate(lines):_text(c,LEFT+8,y-i*13,line,7.6)
   _right(c,LEFT+328,y,item.quantity[:8],7.5)
   _right(c,LEFT+385,y,item.unit[:8],7.4)
   _right(c,LEFT+455,y,money(item.price_minor,document.currency).split(' ',1)[-1][:12],7.1)
   _right(c,RIGHT-7,y,money(item.amount_minor,document.currency).split(' ',1)[-1][:13],7.1,INK,True)
   y-=row_height
  y-=13
  totals=[('SUBTOTAL',document.subtotal_minor)]
  if kind=='invoice':totals+=[('DISCOUNT',-document.discount_minor),('TAX',document.tax_minor),('WITHHOLDING',-document.withholding_minor)]
  else:totals+=[('TAX',document.tax_minor)]
  totals.append(('GRAND TOTAL',document.total_minor))
  if kind=='invoice':totals.append(('OUTSTANDING',document.outstanding_minor))
  y=ensure(y,20*len(totals)+25)
  for label,amount in totals:
   if label=='GRAND TOTAL':
    c.setFillColor(HexColor(INK));c.roundRect(LEFT+250,y-16,WIDTH-250,27,5,stroke=0,fill=1)
    _text(c,LEFT+261,y-6,'TOTAL',8.5,WHITE,True)
    _right(c,RIGHT-8,y-6,money(amount,document.currency),9,WHITE,True)
    y-=33;continue
   _text(c,LEFT+262,y,label,8,SLATE,label=='OUTSTANDING')
   _right(c,RIGHT-8,y,money(amount,document.currency),8.5,INK,label=='OUTSTANDING')
   y-=19
  y-=8
  if kind=='invoice':
   banks=sorted(document.bank_instructions,key=lambda b:b.position)
   if banks:
    y=section('Payment instructions / bank transfer',y)
    for i,bank in enumerate(banks,1):
     y=ensure(y,57)
     c.setFillColor(HexColor(PAPER));c.roundRect(LEFT,y-45,WIDTH,53,6,stroke=0,fill=1)
     _text(c,LEFT+12,y-5,f'ACCOUNT {i:02d}  {bank.bank_name[:40]} / {bank.currency}',8.2,INK,True)
     _text(c,LEFT+12,y-20,bank.account_number[:44],10,RED,True)
     _text(c,LEFT+12,y-34,bank.account_holder[:65],7.9,SLATE)
     if bank.swift_code:_right(c,RIGHT-10,y-34,'SWIFT '+bank.swift_code[:11],7.4,SLATE)
     y-=65
   else:
    y=section('Payment instructions',y)
    _text(c,LEFT,y,'Bank account not specified on this document.',8.2,SLATE);y-=27
  notes=(document.notes or '').strip()
  if notes:
   y=section('Notes / terms',y)
   for line in _wrap(notes,85):
    y=ensure(y,13);_text(c,LEFT,y,line,8);y-=12
 else:
  y=section('Payment acknowledgment',y)
  y=ensure(y,72)
  c.setFillColor(HexColor(INK));c.roundRect(LEFT,y-58,WIDTH,67,8,stroke=0,fill=1)
  _text(c,LEFT+16,y-13,'AMOUNT RECEIVED',9,'#E8B3AA',True)
  _text(c,LEFT+16,y-42,money(payment.amount_minor,inv.currency),18,WHITE,True)
  y-=86
  for label,value in [('PAYMENT DATE',payment.date),('PAYMENT METHOD',payment.method),('TRANSACTION REFERENCE',payment.reference or 'Not provided')]:
   y=kv(label,value,y,max_cols=75)
  if payment.receiving_bank_snapshot:
   bank=payment.receiving_bank_snapshot
   y=section('Receiving bank account',y)
   for line in [bank.get('bank_name',''),bank.get('account_number',''),bank.get('account_holder','')]:
    y=ensure(y,17);_text(c,LEFT,y,line[:72],8.6);y-=18
  if document.stamp_required:
   y=ensure(y,63)
   c.setStrokeColor(HexColor(RED));c.setLineWidth(1);c.roundRect(LEFT,y-48,WIDTH,57,5,stroke=1,fill=0)
   _text(c,LEFT+12,y-10,'E-METERAI / MANUAL ADMIN WORKFLOW',8.2,RED,True)
   _text(c,LEFT+12,y-27,'Final customer PDF released after manual stamp upload.',7.2,SLATE)
   y-=75
 if pages[0]>=1:
  c.save()
 return buffer.getvalue()
