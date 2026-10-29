"""Single-page, measured A4 layout for invoices and quotations (up to 10 items).

Unlike automatic page breaks, this renderer fits the *whole* document before
returning bytes. It never silently drops item descriptions, notes or bank data.
Unreasonably verbose inputs raise DocumentTooLong with an actionable message.
"""
from __future__ import annotations
import io
import math
from pathlib import Path

import qrcode
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader

INK = '#101720'
RED = '#B43E31'
SLATE = '#64717C'
PAPER = '#F7F7F4'
RULE = '#DCE0E1'
WHITE = '#FFFFFF'
W, H = A4
LEFT = 43
RIGHT = W-43
WIDTH = RIGHT-LEFT
FOOTER_TOP = 86
ART = Path(__file__).parent / 'static' / 'assets'


class DocumentTooLong(ValueError):
    """The document cannot fit a readable single A4 page; shorten its content."""


def _wrap(value, width, font, size):
    """Pixel-accurate monospace line wrapping, including uninterrupted tokens."""
    rows = []
    for paragraph in str(value or '').replace('\r','').split('\n'):
        if not paragraph.strip():
            rows.append('')
            continue
        line = ''
        for word in paragraph.split():
            candidate = f'{line} {word}' if line else word
            if pdfmetrics.stringWidth(candidate, font, size) <= width:
                line = candidate
                continue
            if line:
                rows.append(line)
                line = ''
            # Very long references/words also wrap; never truncate.
            while word and pdfmetrics.stringWidth(word, font, size) > width:
                take = max(1, int(width/(size*0.6)))
                while take > 1 and pdfmetrics.stringWidth(word[:take],font,size)>width:
                    take-=1
                rows.append(word[:take]); word=word[take:]
            line=word
        if line or not rows: rows.append(line)
    return rows


def render_compact_document(db,kind,document,verification_url,money):
    """Render a one-page A4 document, verifying layout before returning bytes."""
    from .db import Setting
    if kind not in ('invoice','quotation'):
        raise ValueError('Compact layout supports invoice and quotation')
    items = list(document.items)
    if len(items)>10:
        raise ValueError('Compact layout is used for a maximum of 10 line items')
    recipient = document.customer or (document.lead if kind == 'quotation' else None)
    if recipient is None:
        raise ValueError('Missing document recipient')
    settings={r.key:r.value for r in db.query(Setting).all()}
    legal = settings.get('legal_name') or 'PT Satu Arah International'
    office = settings.get('address') or ''
    office_email = settings.get('email') or 'info@voraworld.id'
    recipient_name = getattr(recipient,'name','')
    if kind=='quotation' and not document.customer and getattr(recipient,'company',''):
        recipient_name = recipient.company
    recipient_address = getattr(recipient,'address','')
    recipient_email = getattr(recipient,'email','')
    recipient_tax = getattr(recipient,'tax_id','')
    banks = sorted(getattr(document,'bank_instructions',[]) or [],key=lambda a:a.position) if kind=='invoice' else []
    # Scale down modestly and *measure* each candidate. Never turn a 2-page
    # invoice into a 1-page invoice by clipping the footer / last bank account.
    for fs in (8.0,7.7,7.4,7.1,6.8,6.5):
        buf=io.BytesIO()
        c=canvas.Canvas(buf,pagesize=A4,pageCompression=1)
        c.setTitle(f'{kind.upper()} | {document.number}')
        c.setAuthor('VORA | PT Satu Arah International')
        c.setSubject('VORA business document')
        def txt(x,y,value,size=fs,color=INK,bold=False):
            c.setFillColor(HexColor(color));c.setFont('Courier-Bold' if bold else 'Courier',size)
            c.drawString(x,y,str(value))
        def rt(x,y,value,size=fs,color=INK,bold=False):
            c.setFillColor(HexColor(color));c.setFont('Courier-Bold' if bold else 'Courier',size)
            c.drawRightString(x,y,str(value))
        def rule(y):
            c.setStrokeColor(HexColor(RULE));c.setLineWidth(.65);c.line(LEFT,y,RIGHT,y)
        def section(title,y):
            txt(LEFT,y,title.upper(),max(6.7,fs-.4),RED,True)
            rule(y-5)
            return y-15
        def lines_at(x,y,content,width,sz=None,color=INK,bold=False,leading=None):
            sz=sz or fs
            leading=leading or sz+2
            lines=_wrap(content,width,'Courier-Bold' if bold else 'Courier',sz)
            for line in lines:
                txt(x,y,line,sz,color,bold);y-=leading
            return y
        # branding and QR footer are fixed, reserved from available content area
        c.setFillColor(HexColor(WHITE));c.rect(0,0,W,H,stroke=0,fill=1)
        watermark=ART/'vora-a-watermark.png'
        if watermark.exists():
            c.drawImage(ImageReader(str(watermark)),W/2-168,H/2-101,width=336,height=202,mask='auto')
        c.setFillColor(HexColor(INK));c.rect(0,H-89,W,89,stroke=0,fill=1)
        c.setFillColor(HexColor(RED));c.rect(0,H-92,W,3,stroke=0,fill=1)
        logo=ART/'vora-reverse.png'
        if logo.exists():c.drawImage(ImageReader(str(logo)),LEFT,H-65,width=137,height=30,mask='auto')
        txt(LEFT,H-79,'FREIGHT & LOGISTICS',7,WHITE)
        rt(RIGHT,H-39,kind.upper(),16,WHITE,True)
        rt(RIGHT,H-54,document.number,6.8,WHITE)
        rt(RIGHT,H-74,(document.status or 'draft').upper(),7,'#E8B3AA',True)
        rule(FOOTER_TOP)
        txt(LEFT,68,'VORA / DOCUMENT VERIFICATION',7.7,SLATE,True)
        txt(LEFT,54,'Scan QR for document number and current status.',6.8,SLATE)
        txt(LEFT,39,office_email,7.2,INK)
        txt(LEFT,25,f'{kind.upper()}  /  1 OF 1',7.1,SLATE)
        qr=qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M,box_size=3,border=1)
        qr.add_data(verification_url);qr.make(fit=True)
        c.drawImage(ImageReader(qr.make_image(fill_color=INK,back_color='white').convert('RGB')),
                    RIGHT-65,13,64,64,mask='auto',preserveAspectRatio=False)
        y=H-108
        second_x=LEFT+WIDTH/2+8
        col_w=WIDTH/2-16
        txt(LEFT,y,'ISSUED BY',7.1,RED,True)
        txt(second_x,y,'BILL TO / OFFERED TO',7.1,RED,True)
        y-=14
        issuer_parts=[(legal,True,INK),(office,False,SLATE),(office_email,False,SLATE)]
        recipient_parts=[(recipient_name,True,INK),(recipient_address,False,SLATE),(recipient_email,False,SLATE)]
        if recipient_tax:recipient_parts.append((f'TAX ID: {recipient_tax}',False,SLATE))
        def draw_party(x,parts):
            pos=y
            for part,bold,color in parts:
                if not part: continue
                pos=lines_at(x,pos,part,col_w,sz=fs-.15 if not bold else fs,color=color,bold=bold,leading=fs+1.7)
                pos-=2
            return pos
        y=min(draw_party(LEFT,issuer_parts),draw_party(second_x,recipient_parts))-7
        rule(y);y-=14
        # Two compact lines of 4 fields; no vertically stacked label/value cards
        def metadata(label,value,x,yy,width=WIDTH/4-6):
            txt(x,yy,label.upper(),6.8,SLATE)
            sz=max(6.1,fs-.3)
            for i,line in enumerate(_wrap(value,width,'Courier-Bold',sz)):
                txt(x,yy-11-i*(sz+1),line,sz,INK,True)
            return len(_wrap(value,width,'Courier-Bold',sz))
        slots=[('ISSUED',document.issued_at),('CURRENCY',document.currency),('STATUS',document.status),
               ('DUE' if kind=='invoice' else 'VALID UNTIL',document.due_at if kind=='invoice' else document.valid_until)]
        meta_max=max(metadata(key,value,LEFT+(WIDTH/4)*i,y) for i,(key,value) in enumerate(slots))
        y-=12+meta_max*(fs+1.5)+8
        if kind=='invoice' and (getattr(document,'po_number',None) or getattr(document,'shipment_reference',None)):
            ref1=f"PO: {document.po_number or '-'}"
            ref2=f"SHIPMENT/JOB: {document.shipment_reference or '-'}"
            y1=lines_at(LEFT,y,ref1,WIDTH/2-12,sz=max(6.5,fs-.4),color=SLATE,leading=fs+1.5)
            y2=lines_at(second_x,y,ref2,WIDTH/2-12,sz=max(6.5,fs-.4),color=SLATE,leading=fs+1.5)
            y=min(y1,y2)-6
        y=section('Services / charges',y)
        c.setFillColor(HexColor(PAPER));c.roundRect(LEFT,y-11,WIDTH,21,4,stroke=0,fill=1)
        txt(LEFT+7,y-4,'DESCRIPTION',6.7,SLATE,True)
        rt(LEFT+317,y-4,'QTY',6.7,SLATE,True)
        rt(LEFT+369,y-4,'UNIT',6.7,SLATE,True)
        rt(LEFT+433,y-4,'RATE',6.7,SLATE,True)
        rt(RIGHT-6,y-4,'AMOUNT',6.7,SLATE,True)
        y-=24
        desc_width=246
        item_size=max(6.25,fs-.35)
        amount_size=max(5.9,fs-.75)
        for i,item in enumerate(items,1):
            description=f'{i:02d}  {item.description}'
            desc_lines=_wrap(description,desc_width,'Courier',item_size)
            leading=item_size+1.6
            row_h=max(17,len(desc_lines)*leading+4)
            rule(y+7)
            for n,line in enumerate(desc_lines):txt(LEFT+7,y-n*leading,line,item_size)
            rt(LEFT+317,y,str(item.quantity),amount_size)
            rt(LEFT+369,y,str(item.unit),amount_size)
            rt(LEFT+433,y,money(item.price_minor,document.currency).split(' ',1)[-1],amount_size)
            rt(RIGHT-6,y,money(item.amount_minor,document.currency).split(' ',1)[-1],amount_size,INK,True)
            y-=row_h
        rule(y+6);y-=11
        totals=[('SUBTOTAL',document.subtotal_minor)]
        if kind=='invoice':
            totals.extend([('DISCOUNT',-document.discount_minor),('TAX',document.tax_minor),('WITHHOLDING',-document.withholding_minor)])
        else:totals.append(('TAX',document.tax_minor))
        totals.append(('GRAND TOTAL',document.total_minor))
        if kind=='invoice':totals.append(('OUTSTANDING',document.outstanding_minor))
        for label,value in totals:
            if label=='GRAND TOTAL':
                c.setFillColor(HexColor(INK));c.roundRect(LEFT+WIDTH*.49,y-16,WIDTH*.51,25,4,stroke=0,fill=1)
                txt(LEFT+WIDTH*.51,y-6,'TOTAL',max(7,fs),WHITE,True)
                rt(RIGHT-7,y-6,money(value,document.currency),max(7,fs),WHITE,True)
                y-=28
            else:
                txt(LEFT+WIDTH*.52,y,label,fs-.1,SLATE,label=='OUTSTANDING')
                rt(RIGHT-6,y,money(value,document.currency),fs,INK,label=='OUTSTANDING')
                y-=max(12.5,fs+5)
        y-=2
        if banks:
            y=section('Bank transfer / payment instructions',y)
            bank_col_w=WIDTH/2-12
            left_x=LEFT+6
            right_x=second_x
            for index in range(0,len(banks),2):
                bank_group=banks[index:index+2]
                h_list=[]
                for j,bank in enumerate(bank_group):
                    x=left_x if j==0 else right_x
                    header=f'{index+j+1:02d} {bank.bank_name} / {bank.currency}'
                    lines1=_wrap(header,bank_col_w,'Courier-Bold',max(6.2,fs-.4))
                    lines2=_wrap(bank.account_number,bank_col_w,'Courier-Bold',fs+.35)
                    lines3=_wrap(bank.account_holder,bank_col_w,'Courier',max(6.2,fs-.4))
                    lines4=_wrap('SWIFT: '+bank.swift_code,bank_col_w,'Courier',max(6.0,fs-.5)) if bank.swift_code else []
                    texts=[(lines1,max(6.2,fs-.4),INK,True),
                           (lines2,fs+.35,RED,True),(lines3,max(6.2,fs-.4),SLATE,False),
                           (lines4,max(6.0,fs-.5),SLATE,False)]
                    yy=y
                    for bank_lines,sz,color,bold in texts:
                        for line in bank_lines:
                            txt(x,yy,line,sz,color,bold);yy-=sz+1.6
                    h_list.append(y-yy)
                y-=max(h_list)+6
        notes=(document.notes or '').strip()
        if notes:
            y=section('Notes / terms',y)
            y=lines_at(LEFT,y,notes,WIDTH-4,sz=max(6.3,fs-.5),leading=max(8,fs+1))
            y-=2
        if kind=='quotation':
            # An explicit acknowledgment field in the customer copy; signature
            # and stamp are added by the recipient via the secure approval flow.
            y=section('Approved by customer',y)
            txt(LEFT+6,y,'AUTHORIZED SIGNATURE',max(6.4,fs-.4),SLATE,True)
            txt(second_x,y,'COMPANY STAMP',max(6.4,fs-.4),SLATE,True)
            c.setStrokeColor(HexColor(RULE));c.line(LEFT+6,y-40,second_x-18,y-40)
            c.line(second_x,y-40,RIGHT-5,y-40)
            y-=46
        # Return only when everything has genuinely fitted above the reserved footer.
        if y>=FOOTER_TOP+11:
            c.save()
            return buf.getvalue()
    raise DocumentTooLong(
        'The document is too long for a readable single A4 page. '
        'Shorten item descriptions / notes, or reduce selected bank accounts. '
        'No invoice, quotation, bank detail or amount has been silently omitted.'
    )
