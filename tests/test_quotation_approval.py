"""Approval link, signed PDF upload and manual Finance approval, with fake SMTP dispatch."""
import re
from datetime import date, timedelta
from io import BytesIO
from pypdf import PdfReader
from fastapi.testclient import TestClient
from test_e2e import csrf, login
from vora.main import app,password_hash
from vora.db import Session, Customer, Quotation, QuotationApproval, EmailJob, MailConfig, EmailRule, User


def test_quotation_customer_approval(monkeypatch):
    # Real SMTP delivery is external; test the queued message, attachment, token and workflow.
    monkeypatch.setattr('vora.main._notify_cleared_payment',lambda *_: {'sent':0,'failed':0})
    monkeypatch.setenv('PUBLIC_BASE_URL','https://testserver')
    with Session() as db:
        if not db.query(User).filter_by(email='owner@invalid.example').first():
            db.add(User(email='owner@invalid.example',password_hash=password_hash('LocalTestPass!9'),role='superadmin'))
            db.commit()
    with TestClient(app) as client:
        login(client)
        with Session() as db:
            c=Customer(name='QUOTATION APPROVAL QA CLIENT',email='quote-qa@example.invalid',currency='IDR')
            db.add(c);db.flush();customer_id=c.id
            settings=MailConfig(id=1,host='smtp.example.invalid',port=587,security='starttls',
                                from_email='info@voraworld.id',admin_email='info@voraworld.id',enabled=True)
            old=db.get(MailConfig,1)
            if old:
                old.host=settings.host;old.enabled=True
            else:db.add(settings)
            rule=db.get(EmailRule,'quotation_approval_request')
            rule.enabled=True
            db.commit()
        today=date.today()
        quote_form={'csrf':csrf(client),'recipient':f'customer:{customer_id}',
                    'issued_at':today.isoformat(), 'valid_until':(today+timedelta(days=10)).isoformat(),
                    'items':'Sea export freight | 2 | 3500000 | container',
                    'notes':'Approval only after company stamp and signature','tax_percent':'0'}
        assert client.post('/admin/quotations/new',data=quote_form,follow_redirects=False).status_code==303
        with Session() as db:
            quote=db.query(Quotation).order_by(Quotation.id.desc()).first();quote_id=quote.id
            assert quote.number.startswith('QUO-VORA-')
        assert client.post(f'/admin/quotations/{quote_id}/status',
                           data={'csrf':csrf(client),'action':'issue'},follow_redirects=False).status_code==303
        r=client.post(f'/admin/quotations/{quote_id}/request-approval',data={'csrf':csrf(client)},follow_redirects=False)
        assert r.status_code==303,r.text
        with Session() as db:
            job=db.query(EmailJob).filter_by(event='quotation_approval_request',attachment_id=quote_id).one()
            assert job.status=='queued'
            assert job.attachment_kind=='quotation'
            item=db.query(QuotationApproval).filter_by(quotation_id=quote_id).one()
            assert item.status=='pending'
            assert 'quotation-approval/' in job.html
            match=re.search(r'/quotation-approval/([A-Za-z0-9_-]+)',job.html)
            assert match, job.html
            token=match.group(1)
            quote_number=db.get(Quotation,quote_id).number
        page=client.get(f'/quotation-approval/{token}')
        assert page.status_code==200 and 'noindex' in page.text and quote_number in page.text
        assert client.get('/quotation-approval/random-not-found').status_code==404
        pdf=client.get(f'/quotation-approval/{token}/pdf')
        assert pdf.status_code==200 and pdf.content[:4]==b'%PDF'
        assert quote_number in ' '.join(p.extract_text() or '' for p in PdfReader(BytesIO(pdf.content)).pages)
        response=client.post(f'/quotation-approval/{token}',
           data={'csrf':csrf(client),'signer_name':'Authorized Signature QA','signer_title':'Director','ack':'yes'},
           files={'signed_pdf':('customer-signed-and-stamped.pdf',pdf.content,'application/pdf')})
        assert response.status_code==200,response.text
        with Session() as db:
            item=db.query(QuotationApproval).filter_by(quotation_id=quote_id).one()
            assert item.status=='submitted' and item.signed_pdf_sha256 and item.signed_pdf_key
            approval_id=item.id
        assert client.get(f'/admin/quotation-approvals/{approval_id}/file').status_code==200
        denied=client.post(f'/admin/quotation-approvals/{approval_id}/review',
              data={'csrf':csrf(client),'action':'approve'},follow_redirects=False)
        assert denied.status_code==422
        approved=client.post(f'/admin/quotation-approvals/{approval_id}/review',
              data={'csrf':csrf(client),'action':'approve','signature_and_stamp_verified':'yes'},follow_redirects=False)
        assert approved.status_code==303
        with Session() as db:
            assert db.get(Quotation,quote_id).status=='approved'
            assert db.get(QuotationApproval,approval_id).status=='approved'
        assert client.get(f'/quotation-approval/{token}/pdf').status_code==410
        assert client.post(f'/quotation-approval/{token}',
              data={'csrf':csrf(client),'signer_name':'Reuser','signer_title':'MD','ack':'yes'},
              files={'signed_pdf':('dup.pdf',pdf.content,'application/pdf')}).status_code==410


def test_invoice_customer_email_and_private_scheduler(monkeypatch):
    from vora.db import Invoice, InvoiceItem, Verification, Setting
    from vora.logic import calc_lines,ensure_public_code,next_number,create_verification
    from vora.mail import dispatch
    monkeypatch.setenv('PUBLIC_BASE_URL','https://testserver')
    # Network transport is replaced; everything up to the SMTP adapter runs for real.
    delivered=[]
    monkeypatch.setattr('vora.mail.send_smtp',lambda conf,to,subject,body,attachment=None: delivered.append((to,attachment)))
    with Session() as db:
        if not db.query(User).filter_by(email='owner@invalid.example').first():
            db.add(User(email='owner@invalid.example',password_hash=password_hash('LocalTestPass!9'),role='superadmin'))
        customer=Customer(name='QA EMAIL CUSTOMER',email='finance-qa@example.invalid',currency='IDR')
        db.add(customer);db.flush();code=ensure_public_code(db,customer)
        values=calc_lines([{'description':'Freight fee','quantity':'1','price':'1200000','unit':'shipment'}],'IDR')
        inv=Invoice(number=next_number(db,'INV',code,date.today().isoformat()),customer_id=customer.id,
                    issued_at=date.today().isoformat(),due_at=date.today().isoformat(),status='issued',currency='IDR',
                    subtotal_minor=values['subtotal_minor'],tax_minor=0,withholding_minor=0,
                    total_minor=values['total_minor'],outstanding_minor=values['total_minor'])
        db.add(inv);db.flush();db.add(InvoiceItem(invoice_id=inv.id,**values['items'][0]))
        create_verification(db,'invoice',inv.id)
        conf=db.get(MailConfig,1)
        if not conf:conf=MailConfig(id=1,host='smtp.example.invalid',enabled=True);db.add(conf)
        conf.enabled=True
        rule=db.get(EmailRule,'invoice_customer');rule.enabled=True
        db.commit();invoice_id=inv.id
    monkeypatch.setattr('vora.main._notify_cleared_payment',lambda *_: {'sent':0,'failed':0})
    with TestClient(app) as client:
        login(client)
        response=client.post(f'/admin/invoices/{invoice_id}/send',data={'csrf':csrf(client)},follow_redirects=False)
        assert response.status_code==303,response.text
        with Session() as db:
            queued=db.query(EmailJob).filter_by(attachment_kind='invoice',attachment_id=invoice_id).one()
            assert queued.status=='queued'
            result=dispatch(db,'https://testserver')
            assert result['sent']>=1
            assert db.get(EmailJob,queued.id).status=='sent'
        assert any(mail[0]=='finance-qa@example.invalid' and mail[1] and mail[1][1][:4]==b'%PDF' for mail in delivered)
        assert client.get('/internal/mail/dispatch').status_code==401
        monkeypatch.setenv('CRON_SECRET','s'*40)
        assert client.get('/internal/mail/dispatch',headers={'Authorization':'Bearer '+'s'*40}).status_code==200
