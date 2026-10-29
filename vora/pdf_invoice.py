"""Branded A4 invoice layout: max FIVE line items per physical page.

All pages repeat the official issuer/recipient context and secure QR footer.
Only the final page carries financial totals, bank instructions and notes.
If unusually verbose content cannot fit, the financial summary moves to
an additional page instead of clipping or silently omitting information.
"""
from __future__ import annotations
import io
from pathlib import Path

import qrcode
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfgen import canvas

INK = '#101720'
RED = '#B43E31'
SLATE = '#64717C'
PALE = '#F7F7F4'
RULE = '#DCE0E1'
WHITE = '#FFFFFF'
W, H = A4
L, R = 44, W-44
WIDTH = R-L
ART = Path(__file__).parent/'static'/'assets'
FOOTER_LIMIT = 99
MAX_ITEMS_PER_PAGE = 5


class InvoiceLayoutError(ValueError):
    """Raised rather than silently clipping invoice data."""


def _lines(content, max_width, size=8.2, bold=False):
    font = 'Courier-Bold' if bold else 'Courier'
    text = str(content or '').replace('\r','')
    result = []
    for part in text.split('\n'):
        if not part.strip():
            result.append('')
            continue
        acc = ''
        for word in part.split():
            candidate = (acc+' '+word).strip()
            if pdfmetrics.stringWidth(candidate,font,size) <= max_width:
                acc = candidate
                continue
            if acc:
                result.append(acc)
                acc = ''
            while word and pdfmetrics.stringWidth(word,font,size) > max_width:
                n = max(1,int(max_width/(size*.61)))
                while n>1 and pdfmetrics.stringWidth(word[:n],font,size)>max_width:
                    n-=1
                result.append(word[:n])
                word=word[n:]
            acc=word
        if acc:result.append(acc)
    return result


def render_invoice(db, invoice, verification_url, money):
    from .db import Setting
    items=list(invoice.items)
    if not items:
        raise InvoiceLayoutError('An invoice must contain at least one line item')
    customer=invoice.customer
    if customer is None:
        raise InvoiceLayoutError('Invoice recipient is missing')
    settings={s.key:s.value for s in db.query(Setting).all()}
    issuer=settings.get('legal_name') or 'PT Satu Arah International'
    office=settings.get('address') or ''
    email=settings.get('email') or 'info@voraworld.id'
    banks=sorted(invoice.bank_instructions,key=lambda b:b.position)
    chunks=[items[n:n+MAX_ITEMS_PER_PAGE] for n in range(0,len(items),MAX_ITEMS_PER_PAGE)]
    code=invoice.number
    art_logo=ART/'vora-reverse.png'
    art_mark=ART/'vora-a-watermark.png'
    qr=qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M,box_size=4,border=1)
    qr.add_data(verification_url)
    qr.make(fit=True)
    qr_img=ImageReader(qr.make_image(fill_color=INK,back_color='white').convert('RGB'))

    def compose(summary_page=False):
        pages=chunks + ([[]] if summary_page else [])
        result=io.BytesIO()
        c=canvas.Canvas(result,pagesize=A4,pageCompression=1)
        c.setTitle(f'INVOICE | {code}')
        c.setAuthor('VORA | PT Satu Arah International')
        c.setSubject('Invoice with online document verification')

        def text(x,y,v,sz=8,color=INK,bold=False):
            c.setFont('Courier-Bold' if bold else 'Courier',sz)
            c.setFillColor(HexColor(color))
            c.drawString(x,y,str(v))
        def right(x,y,v,sz=8,color=INK,bold=False):
            c.setFont('Courier-Bold' if bold else 'Courier',sz)
            c.setFillColor(HexColor(color))
            c.drawRightString(x,y,str(v))
        def rule(y,x1=L,x2=R,color=RULE):
            c.setStrokeColor(HexColor(color))
            c.setLineWidth(.65)
            c.line(x1,y,x2,y)
        def block(x,y,data,width,sz=8,leading=10.3,color=INK,bold=False):
            for line in _lines(data,width,sz,bold):
                text(x,y,line,sz,color,bold)
                y-=leading
            return y
        def panel_title(y,title,index=None):
            text(L,y,title,8.4,INK,True)
            if index:right(R,y,index,7.2,SLATE)
            c.setFillColor(HexColor(RED));c.rect(L,y-10,31,2.5,stroke=0,fill=1)
            rule(y-10,L+38,R)
            return y-26
        def header(page_num,total):
            c.setFillColor(HexColor(WHITE));c.rect(0,0,W,H,stroke=0,fill=1)
            if art_mark.exists():
                # The official A mark remains a subtle watermark, never a recreated logo.
                c.drawImage(ImageReader(str(art_mark)),W/2-173,H/2-99,width=346,height=198,mask='auto')
            c.setFillColor(HexColor(INK));c.rect(0,H-100,W,100,stroke=0,fill=1)
            c.setFillColor(HexColor(RED));c.rect(0,H-104,W,4,stroke=0,fill=1)
            if art_logo.exists():
                c.drawImage(ImageReader(str(art_logo)),L,H-69,width=144,height=32,mask='auto')
            text(L,H-84,'Bringing the World Within Reach.',7.05,'#DCE0E1')
            right(R,H-42,'COMMERCIAL INVOICE',16.8,WHITE,True)
            right(R,H-63,code,7.3,'#E9ECEE')
            payment_pct=(100*(invoice.total_minor-invoice.outstanding_minor)/invoice.total_minor) if invoice.total_minor else 0
            payment_state=('OFFICIALLY PAID' if invoice.outstanding_minor==0 else ('PARTIALLY PAID' if payment_pct>0 else 'AWAITING PAYMENT'))
            issuance_state='VOID' if invoice.status=='void' else ('DRAFT' if invoice.status=='draft' else 'ISSUED')
            right(R,H-83,f'{issuance_state} / {payment_state}',7.0,'#E8B3AA',True)
            # Repeated verification details on every page.
            rule(83)
            text(L,66,'VORA / DIGITAL DOCUMENT VERIFICATION',7.6,INK,True)
            text(L,51,'Scan QR to check document status with VORA.',7.1,SLATE)
            text(L,36,email,7.6,INK)
            text(L,21,f'DOCUMENT  /  PAGE {page_num:02d} OF {total:02d}',7.3,SLATE)
            c.drawImage(qr_img,R-73,8,72,72,mask='auto',preserveAspectRatio=False)

        def parties_and_metadata(page_idx):
            y=H-125
            x2=L+260
            col_width=WIDTH/2-15
            text(L,y,'ISSUED BY',7.7,RED,True)
            text(x2,y,'BILL TO',7.7,RED,True)
            yy=y-18
            def party(x,name,address,contact,tax=''):
                here=block(x,yy,name,col_width,9.25,12,INK,True)-2
                if address:here=block(x,here,address,col_width,7.7,9.5,SLATE)-1.5
                if contact:here=block(x,here,contact,col_width,7.4,9.5,SLATE)-1.5
                if tax:here=block(x,here,f'TAX ID: {tax}',col_width,7.4,9.5,SLATE)
                return here
            py1=party(L,issuer,office,email)
            py2=party(x2,customer.name,customer.address or '',customer.email or '',customer.tax_id or '')
            y=min(py1,py2)-8
            if y<H-237:
                raise InvoiceLayoutError('Billing details are too long to display safely')
            rule(y)
            y-=10
            c.setFillColor(HexColor(PALE));c.roundRect(L,y-42,WIDTH,43,6,stroke=0,fill=1)
            from datetime import date as _date
            try:
                actual_terms=(_date.fromisoformat(invoice.due_at)-_date.fromisoformat(invoice.issued_at)).days
                due_caption=f'DUE / NET {actual_terms} DAYS' if actual_terms>=0 else 'DUE DATE'
            except (TypeError,ValueError):
                due_caption='DUE DATE'
            columns=[('ISSUED ON',invoice.issued_at),(due_caption,invoice.due_at),('CURRENCY',invoice.currency),('STATUS',invoice.status.upper().replace('_',' '))]
            for i,(name,value) in enumerate(columns):
                x=L+10+i*(WIDTH/4)
                text(x,y-13,name,7.0,SLATE,True)
                vals=_lines(value,WIDTH/4-12,8.1,True)
                if len(vals)>1:raise InvoiceLayoutError(f'Invalid document metadata: {name}')
                text(x,y-30,vals[0] if vals else '',8.1,INK,True)
            y-=57
            if invoice.po_number or invoice.shipment_reference:
                xx=L+8
                for label,value in [('PO',invoice.po_number),('SHIPMENT / JOB',invoice.shipment_reference)]:
                    if value:
                        t=f'{label}: {value}'
                        words=_lines(t,WIDTH*.48,7.2)
                        if len(words)>2:raise InvoiceLayoutError('PO / shipment reference is too long')
                        for j,line in enumerate(words):text(xx,y-j*9,line,7.2,SLATE)
                    xx=L+WIDTH*.5
                y-=max(13,20 if len(_lines(invoice.po_number,WIDTH*.48,7.2))>1 else 13)
            logistics=[('SERVICE MODE',getattr(invoice,'service_mode','')),('ROUTE',(' -> '.join(v for v in (getattr(invoice,'origin',''),getattr(invoice,'destination','')) if v))),('B/L / AWB REF',getattr(invoice,'transport_document_ref',''))]
            logistics=[(label,val) for label,val in logistics if val]
            if logistics:
                # Make the service context informative, but don't fabricate blank logistics values.
                for label,value in logistics:
                    rows=_lines(f'{label}: {value}',WIDTH-16,7.0)
                    if len(rows)>2:
                        raise InvoiceLayoutError(f'{label} is too long for the document')
                    for line in rows:
                        text(L+8,y,line,7.0,SLATE)
                        y-=9.2
                y-=3
            return y-6

        def draw_items(y,portion,offset):
            y=panel_title(y,'ITEMIZED FREIGHT & LOGISTICS CHARGES',f'{len(items):02d} LINE ITEMS / MAX 05 PER PAGE')
            c.setFillColor(HexColor(PALE));c.roundRect(L,y-13,WIDTH,27,5,stroke=0,fill=1)
            text(L+8,y-4,'DESCRIPTION',7.2,SLATE,True)
            right(L+307,y-4,'QTY',7.1,SLATE,True)
            right(L+357,y-4,'UNIT',7.1,SLATE,True)
            right(L+422,y-4,'RATE',7.1,SLATE,True)
            right(R-7,y-4,'AMOUNT',7.1,SLATE,True)
            y-=27
            for n,item in enumerate(portion,offset+1):
                description=str(item.description)
                if not __import__('re').match(r'^\s*\d{1,2}\s+',description):
                    description=f'{n:02d}  {description}'
                d=_lines(description,246,8.1)
                if len(d)>5:
                    raise InvoiceLayoutError(f'Line item {n} description is too long; shorten it')
                row_h=max(29,len(d)*10+9)
                if y-row_h<FOOTER_LIMIT+18:
                    raise InvoiceLayoutError(f'Line item {n} does not fit. Shorten its description')
                for j,line in enumerate(d):text(L+8,y-12-j*10.3,line,8.1,INK)
                value_y=y-13
                def amount_field(x,value,size=7.7):
                    raw=str(value)
                    if pdfmetrics.stringWidth(raw,'Courier',size)>75:
                        raise InvoiceLayoutError(f'Line item {n} value is too wide for the price column')
                    right(x,value_y,raw,size,INK)
                amount_field(L+307,item.quantity,7.7)
                amount_field(L+357,item.unit,7.6)
                amount_field(L+422,money(item.price_minor,invoice.currency).split(' ',1)[-1],7.5)
                amount_field(R-7,money(item.amount_minor,invoice.currency).split(' ',1)[-1],7.5)
                y-=row_h
                rule(y)
            return y-16

        def summary(y):
            y=panel_title(y,'PAYMENT, TAX & SETTLEMENT RECONCILIATION','FINANCIAL SUMMARY')
            x2=L+261
            width2=WIDTH-261
            # Totals in the right hand column, with a high-contrast amount panel.
            z=y
            totals=[('GROSS SUBTOTAL',invoice.subtotal_minor),('DISCOUNT',-invoice.discount_minor),
                    (f'TAX ({invoice.tax_percent}%)',invoice.tax_minor),
                    (f'WITHHOLDING ({invoice.withholding_percent}%)',-invoice.withholding_minor)]
            for title,amount in totals:
                text(x2+8,z,title,7.8,SLATE,title=='GROSS SUBTOTAL')
                right(R-6,z,money(amount,invoice.currency),8,INK,title=='GROSS SUBTOTAL')
                z-=15
            c.setFillColor(HexColor(INK));c.roundRect(x2,z-28,width2,34,7,stroke=0,fill=1)
            c.setFillColor(HexColor(RED));c.roundRect(x2,z-28,4,34,2,stroke=0,fill=1)
            text(x2+12,z-4,'GRAND TOTAL',8.0,'#E9ECEE',True)
            right(R-9,z-19,money(invoice.total_minor,invoice.currency),10.2,WHITE,True)
            z-=43
            text(x2+8,z,'OUTSTANDING',8,INK,True)
            right(R-6,z,money(invoice.outstanding_minor,invoice.currency),8.5,INK,True)
            z-=14
            # Bank accounts are SNAPSHOTS saved with the issued invoice.
            v=y
            if banks:
                text(L+3,v,'BANK TRANSFER / PAYMENT INSTRUCTIONS',7.2,SLATE,True)
                v-=15
                for i,bank in enumerate(banks,1):
                    width=251
                    for line in _lines(f'{i:02d}  {bank.bank_name} / {bank.currency}',width,7.6,True):
                        text(L+3,v,line,7.6,INK,True);v-=10
                    for line in _lines(bank.account_number,width,10.2,True):
                        text(L+3,v,line,10.2,RED,True);v-=12
                    for line in _lines(bank.account_holder,width,7.4):
                        text(L+3,v,line,7.4,SLATE);v-=9
                    if bank.swift_code:
                        text(L+3,v,f'SWIFT: {bank.swift_code}',7.0,SLATE);v-=9
                    v-=4
            else:
                text(L+3,v,'PAYMENT ACCOUNT',7.7,SLATE,True)
                v-=15
                text(L+3,v,'Not specified',7.7,SLATE)
                v-=12
            bottom=min(z,v)-12
            if invoice.notes:
                rule(bottom)
                bottom-=15
                text(L,bottom,'COMMERCIAL NOTES / TERMS',7.9,RED,True)
                bottom-=15
                bottom=block(L,bottom,invoice.notes,WIDTH-2,7.5,9.8,SLATE)-5
            if bottom<FOOTER_LIMIT+12:
                raise InvoiceLayoutError('Payment instructions / notes do not fit with current items')
            return bottom

        for pi,portion in enumerate(pages):
            header(pi+1,len(pages))
            y=parties_and_metadata(pi)
            if portion:
                y=draw_items(y,portion,pi*MAX_ITEMS_PER_PAGE)
            else:
                y=panel_title(y,'PAYMENT SUMMARY / CONTINUATION')
            if pi==len(pages)-1:
                summary(y)
            else:
                text(L,y-6,'CONTINUED  /  PLEASE SEE NEXT PAGE',7.6,RED,True)
                right(R,y-6,f'{min((pi+1)*MAX_ITEMS_PER_PAGE,len(items))} / {len(items)} ITEMS',7.5,SLATE)
            c.showPage()
        c.save()
        return result.getvalue()

    try:
        return compose(False)
    except InvoiceLayoutError as exc:
        if 'Payment instructions / notes do not fit' not in str(exc):
            raise
        # Only the settlement details need an overflow sheet; line items remain 5/page.
        return compose(True)
