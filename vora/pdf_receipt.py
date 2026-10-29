"""Detailed, one-page VORA payment receipt driven by confirmed ledger data.

Never invent bank reference, paid amount, receiving bank, signer or status.
Receipts requiring e-meterai stay in the existing manual-stamp workflow.
"""
from __future__ import annotations
import io
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
import qrcode
from .pdf_invoice import _lines

INK='#101720'
RED='#B43E31'
SLATE='#64717C'
RULE='#DCE0E1'
PALE='#F7F7F4'
WHITE='#FFFFFF'
W,H=A4
L,R=44,W-44
WIDTH=R-L
ART=Path(__file__).parent/'static'/'assets'

class ReceiptLayoutError(ValueError):
    pass

def _english_words(n:int)->str:
    """English cardinal wording for non-negative integer Rupiah; no rounded estimates."""
    if n<0 or n>=10**15:raise ValueError('Amount outside supported terbilang range')
    ones=['Zero','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen']
    tens=['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety']
    def under_1000(value):
        parts=[]
        if value>=100:
            parts.append(ones[value//100]+' Hundred');value%=100
        if value>=20:
            parts.append(tens[value//10]+(('-'+ones[value%10]) if value%10 else ''))
        elif value:parts.append(ones[value])
        return ' '.join(parts)
    if not n:return 'Zero'
    parts=[]
    for base,label in ((10**12,'Trillion'),(10**9,'Billion'),(10**6,'Million'),(10**3,'Thousand'),(1,'')):
        group=n//base;n%=base
        if group:parts.append(under_1000(group)+(' '+label if label else ''))
    return ' '.join(parts)

def render_receipt(db,receipt,verification_url,money):
    from .db import Invoice, Payment, Setting, User
    invoice=db.get(Invoice,receipt.invoice_id)
    payment=db.get(Payment,receipt.payment_id)
    if not invoice or not payment or not invoice.customer:
        raise ReceiptLayoutError('Linked invoice, customer or payment record is missing')
    if payment.status!='recorded':
        raise ReceiptLayoutError('An official receipt requires cleared payment confirmation')
    settings={x.key:x.value for x in db.query(Setting).all()}
    issuer=settings.get('legal_name') or 'PT Satu Arah International'
    address=settings.get('address','')
    email=settings.get('email','info@voraworld.id')
    customer=invoice.customer
    confirmed_total=invoice.total_minor-invoice.outstanding_minor
    if confirmed_total<0 or confirmed_total>invoice.total_minor:
        raise ReceiptLayoutError('Invoice payment reconciliation is inconsistent')
    receipt_state='PARTIALLY PAID' if invoice.outstanding_minor else 'OFFICIALLY PAID'
    document_state='PENDING E-METERAI' if receipt.status=='pending_stamp' else receipt.status.upper().replace('_',' ')
    reviewer=db.get(User,payment.confirmed_by) if payment.confirmed_by else None
    reviewer_label=reviewer.email if reviewer else 'reviewer not specified'
    bank=payment.receiving_bank_snapshot or {}

    out=io.BytesIO()
    c=canvas.Canvas(out,pagesize=A4,pageCompression=1)
    c.setTitle(f'VORA PAYMENT RECEIPT | {receipt.number}')
    c.setAuthor(issuer)
    c.setSubject('Cleared payment record with online document verification')

    def text(x,y,value,size=7.8,color=INK,bold=False):
        c.setFont('Courier-Bold' if bold else 'Courier',size)
        c.setFillColor(HexColor(color))
        c.drawString(x,y,str(value))
    def right(x,y,value,size=7.8,color=INK,bold=False):
        c.setFont('Courier-Bold' if bold else 'Courier',size)
        c.setFillColor(HexColor(color))
        c.drawRightString(x,y,str(value))
    def horizontal(y):
        c.setStrokeColor(HexColor(RULE));c.setLineWidth(.7);c.line(L,y,R,y)
    def lines(x,y,content,width,size=7.5,leading=10,color=INK,bold=False,max_rows=4):
        rows=_lines(content,width,size,bold)
        if len(rows)>max_rows:
            raise ReceiptLayoutError('A receipt field is too long for one A4 page')
        for row in rows:
            if row:text(x,y,row,size,color,bold)
            y-=leading
        return y
    def title(y,heading):
        text(L,y,heading,8.3,INK,True)
        c.setFillColor(HexColor(RED));c.rect(L,y-10,30,2.5,stroke=0,fill=1)
        horizontal(y-10)
        return y-26
    def detail(y,label,value,width=WIDTH):
        text(L+4,y,label,7.2,SLATE,True)
        return lines(L+4,y-13,value,width-8,7.7,10.4,max_rows=3)-4

    c.setFillColor(HexColor(WHITE));c.rect(0,0,W,H,stroke=0,fill=1)
    watermark=ART/'vora-a-watermark.png'
    if watermark.exists():
        c.drawImage(ImageReader(str(watermark)),W/2-151,H/2-98,width=302,height=172,mask='auto')
    c.setFillColor(HexColor(INK));c.rect(0,H-102,W,102,stroke=0,fill=1)
    c.setFillColor(HexColor(RED));c.rect(0,H-106,W,4,stroke=0,fill=1)
    logo=ART/'vora-reverse.png'
    if logo.exists():c.drawImage(ImageReader(str(logo)),L,H-67,width=145,height=32,mask='auto')
    text(L,H-84,'Bringing the World Within Reach.',7.0,'#DCE0E1')
    right(R,H-43,'OFFICIAL PAYMENT RECEIPT',15,WHITE,True)
    right(R,H-64,receipt.number,7,'#E9ECEE')
    right(R,H-84,document_state,7.5,'#E8B3AA',True)

    y=H-130
    x2=L+268
    col=WIDTH/2-16
    text(L,y,'RECEIVED FROM / PAYER',8.0,RED,True)
    text(x2,y,'ISSUED BY / LEGAL ENTITY',8.0,RED,True)
    cy=y-17
    p1=lines(L,cy,customer.name,col,8.8,11,INK,True,2)
    p1=lines(L,p1,customer.address or '',col,7.4,9.8,SLATE,False,4)
    p1=lines(L,p1,customer.email or '',col,7.3,9.5,SLATE,False,2)
    p2=lines(x2,cy,issuer,col,8.5,11,INK,True,2)
    p2=lines(x2,p2,address,col,7.2,9.4,SLATE,False,5)
    p2=lines(x2,p2,email,col,7.2,9.5,SLATE,False,2)
    y=min(p1,p2)-8
    if y<H-264:raise ReceiptLayoutError('Payer/issuer address information is too long')

    y=title(y,'RECEIPT & TREASURY PAYMENT REFERENCE')
    # Four reference values occupy a compact full-width two-column grid.
    refs=[('RECEIPT ISSUED',receipt.created_at.date().isoformat()),
          ('PAYMENT DATE',payment.date),
          ('PAYMENT METHOD',payment.method or 'Not specified'),
          ('BANK TRANSACTION REF',payment.reference or 'Not provided'),
          ('PAYMENT RECORD',f'Payment #{payment.id}'),
          ('INVOICE REFERENCE',invoice.number)]
    max_height=0
    for idx,(label,value) in enumerate(refs):
        xi=L+4+(idx%2)*268
        yy=y-(idx//2)*31
        text(xi,yy,label,7.1,SLATE,True)
        row=_lines(value,245,7.4)
        if len(row)>2:raise ReceiptLayoutError(label+' too long')
        for i,line in enumerate(row):text(xi,yy-12-i*9.5,line,7.4,INK)
        max_height=max(max_height,(idx//2)*31+12+len(row)*9.5)
    y-=max_height+10

    y=title(y,'PAYMENT ALLOCATION & INVOICE BALANCE RECONCILIATION')
    c.setFillColor(HexColor(PALE));c.roundRect(L,y-20,WIDTH,29,5,stroke=0,fill=1)
    cols=[(L+7,'INVOICE TOTAL'),(L+145,'THIS PAYMENT'),(L+302,'TOTAL CONFIRMED'),(R-3,'BALANCE DUE')]
    for x,lab in cols:
        if lab=='BALANCE DUE':right(x,y-2,lab,7.0,SLATE,True)
        else:text(x,y-2,lab,7.0,SLATE,True)
    for x,amount in [(L+7,invoice.total_minor),(L+145,payment.amount_minor),(L+302,confirmed_total),(R-3,invoice.outstanding_minor)]:
        if x==R-3:right(x,y-15,money(amount,invoice.currency),8.2,INK,True)
        else:text(x,y-15,money(amount,invoice.currency),8.1,INK,True)
    y-=43
    text(L+5,y,f'LINKED INVOICE: {invoice.number}',7.3,SLATE)
    y-=19

    y=title(y,'CONFIRMED SETTLEMENT & PAYMENT STATUS')
    c.setFillColor(HexColor(INK));c.roundRect(L,y-50,WIDTH,58,7,stroke=0,fill=1)
    text(L+14,y-10,'CONFIRMED AMOUNT RECEIVED',8.5,'#E8B3AA',True)
    text(L+14,y-36,money(payment.amount_minor,invoice.currency),17,WHITE,True)
    y-=66
    if invoice.currency=='IDR':
        y=detail(y,'AMOUNT RECEIVED IN WORDS',_english_words(payment.amount_minor)+' Indonesian Rupiah')
    y=detail(y,'CURRENT INVOICE PAYMENT STATUS',receipt_state+'  |  Balance due: '+money(invoice.outstanding_minor,invoice.currency))
    note=f'Payment recorded as confirmed; {reviewer_label}'
    if payment.confirmed_at:note+=' on '+payment.confirmed_at.strftime('%Y-%m-%d %H:%M UTC')
    y=detail(y,'FINANCE CONFIRMATION / AUDIT TRACE',note)
    if bank:
        acct=' / '.join([str(bank.get('bank_name','')),str(bank.get('account_number','')),str(bank.get('account_holder',''))])
        y=detail(y,'CREDITED COMPANY BANK ACCOUNT',acct)
    if receipt.stamp_required and receipt.status=='pending_stamp':
        y=detail(y,'DOCUMENT RELEASE CONTROL','Manual official e-meterai application pending; document not released.')
    if y<117:raise ReceiptLayoutError('Receipt contents exceed the reserved A4 layout')

    horizontal(99)
    text(L,83,'VORA / DOCUMENT AUTHENTICITY VERIFICATION',7.8,INK,True)
    text(L,68,'Scan the QR to check this receipt and current status.',7.2,SLATE)
    text(L,53,'Recorded payment data is confirmed in the VORA ledger.',6.9,SLATE)
    text(L,38,'info@voraworld.id',7.2,INK)
    text(L,22,'RECEIPT / PAGE 01 OF 01',7.0,SLATE)
    qr=qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M,box_size=4,border=1)
    qr.add_data(verification_url);qr.make(fit=True)
    c.drawImage(ImageReader(qr.make_image(fill_color=INK,back_color='white').convert('RGB')),R-85,7,width=82,height=82,mask='auto')
    c.showPage();c.save()
    return out.getvalue()
