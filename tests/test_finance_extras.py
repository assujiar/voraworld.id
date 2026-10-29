"""Full settlement, manual e-meterai release, payment-request wording and integrity checks."""
import hashlib, io, re
from datetime import date
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from pypdf import PdfReader
from reportlab.pdfgen import canvas
from test_e2e import csrf, prepare_schema
from test_security import make_user, signed_in
from vora.db import (Session, Customer, Invoice, InvoiceItem, Payment, Receipt, EmailJob, EmailRule, MailConfig, Verification)
from vora.logic import calc_lines, ensure_public_code, next_number, create_verification
from vora.mail import dispatch

NUMBER = re.compile(r'^(INV|RCP|QUO)-VORA-[CL][0-9A-F]{10}-\d{6}-\d{5}$')


def pdf_with(*texts, pages=1):
    out = io.BytesIO(); c = canvas.Canvas(out)
    for _ in range(pages):
        for i, t in enumerate(texts):
            c.drawString(60, 780 - i * 20, t)
        c.showPage()
    c.save()
    return out.getvalue()


def make_invoice(total, email='settle@example.invalid', currency='IDR'):
    with Session() as db:
        customer = Customer(name='SETTLEMENT QA CUSTOMER', email=email, currency=currency)
        db.add(customer); db.flush(); code = ensure_public_code(db, customer)
        values = calc_lines([{'description': 'Freight service', 'quantity': '1', 'price': str(total), 'unit': 'shipment'}], currency)
        inv = Invoice(number=next_number(db, 'INV', code, date.today().isoformat()), customer_id=customer.id,
                      issued_at=date.today().isoformat(), due_at=date.today().isoformat(), status='issued', currency=currency,
                      subtotal_minor=values['subtotal_minor'], tax_minor=0, withholding_minor=0,
                      total_minor=values['total_minor'], outstanding_minor=values['total_minor'])
        db.add(inv); db.flush(); db.add(InvoiceItem(invoice_id=inv.id, **values['items'][0]))
        create_verification(db, 'invoice', inv.id)
        db.commit()
        return inv.id, inv.number


@pytest.fixture()
def finance(tmp_path, monkeypatch):
    prepare_schema()
    monkeypatch.setenv('VORA_LOCAL_PRIVATE_DIR', str(tmp_path))
    monkeypatch.setattr('vora.main._notify_cleared_payment', lambda *_: {'sent': 0, 'failed': 0})
    delivered = []
    monkeypatch.setattr('vora.mail.send_smtp', lambda conf, to, subject, body, attachment=None: delivered.append((to, subject, body, attachment)))
    with Session() as db:
        conf = db.get(MailConfig, 1)
        if not conf:
            conf = MailConfig(id=1); db.add(conf)
        conf.host = 'smtp.example.invalid'; conf.port = 587; conf.from_email = 'info@voraworld.id'
        conf.admin_email = 'info@voraworld.id'; conf.enabled = True
        for key in ('payment_confirmed', 'receipt_customer'):
            db.get(EmailRule, key).enabled = True
        db.commit()
    make_user('finance@settle.invalid', 'finance')
    return signed_in('finance@settle.invalid'), delivered, tmp_path


def pay_and_confirm(c, invoice_id, amount):
    r = c.post(f'/admin/invoices/{invoice_id}/payment', data={'csrf': csrf(c), 'amount': str(amount), 'date': date.today().isoformat(), 'method': 'Cheque', 'reference': f'CHQ-{amount}'}, follow_redirects=False)
    assert r.status_code == 303, r.text
    with Session() as db:
        payment = db.query(Payment).filter_by(invoice_id=invoice_id).order_by(Payment.id.desc()).first()
        assert payment.status == 'pending_confirmation'
        pid = payment.id
    # While pending: invoice balance unchanged, no receipt exists, customer sees "awaiting payment".
    with Session() as db:
        inv = db.get(Invoice, invoice_id)
        assert db.query(Receipt).filter_by(payment_id=pid).count() == 0
    r = c.post(f'/admin/payments/{pid}/confirm', data={'csrf': csrf(c), 'funds_cleared': 'yes'}, follow_redirects=False)
    assert r.status_code == 303, r.text
    with Session() as db:
        return pid, db.query(Receipt).filter_by(payment_id=pid).one().id


def test_full_settlement_with_emeterai_release_and_integrity(finance):
    c, delivered, store = finance
    invoice_id, invoice_number = make_invoice(12_000_000)
    with Session() as db:
        before_jobs = db.query(EmailJob).count()

    # First half: above IDR 5,000,000 -> receipt exists but is withheld until the stamped PDF is uploaded.
    pid1, rid1 = pay_and_confirm(c, invoice_id, 6_000_000)
    with Session() as db:
        inv, rec = db.get(Invoice, invoice_id), db.get(Receipt, rid1)
        assert (inv.status, inv.outstanding_minor) == ('partially_paid', 6_000_000)
        assert rec.status == 'pending_stamp' and rec.stamp_required and NUMBER.match(rec.number)
        kinds = [j.template_key if hasattr(j, 'template_key') else j.event for j in db.query(EmailJob).order_by(EmailJob.id).all()[before_jobs:]]
        assert 'payment_confirmed' in kinds and 'receipt_customer' not in kinds, kinds
        receipt_number = rec.number
        token = db.query(Verification).filter_by(kind='receipt', document_id=rid1).one().token
    assert 'PENDING E-METERAI' in c.get(f'/verify/{token}').text

    # Stamp upload is validated: wrong type, wrong references, missing approval are refused.
    def stamp(body, name='stamped.pdf', ref='EMET-2026-0001', approved='1'):
        return c.post(f'/admin/receipts/{rid1}/stamp', data={'csrf': csrf(c), 'stamp_provider_reference': ref, 'approved': approved},
                      files={'stamped_pdf': (name, body, 'application/pdf')}, follow_redirects=False)
    assert stamp(b'not a pdf' * 80).status_code == 422
    assert stamp(pdf_with('some other document', 'x' * 300)).status_code == 422
    assert stamp(pdf_with(receipt_number, invoice_number), ref='x').status_code == 422
    assert stamp(pdf_with(receipt_number, invoice_number), approved='0').status_code == 422
    good = pdf_with(receipt_number, invoice_number, 'E-METERAI reference EMET-2026-0001')
    assert stamp(good).status_code == 303
    with Session() as db:
        rec = db.get(Receipt, rid1)
        assert rec.status == 'issued' and rec.stamp_sha256 == hashlib.sha256(good).hexdigest()
        assert db.query(EmailJob).filter_by(attachment_kind='receipt', attachment_id=rid1).count() == 1
    assert c.post(f'/admin/receipts/{rid1}/stamp', data={'csrf': csrf(c), 'stamp_provider_reference': 'EMET-2026-0002', 'approved': '1'},
                  files={'stamped_pdf': ('again.pdf', good, 'application/pdf')}).status_code == 409, 'stamp upload is one-shot'
    assert c.get(f'/admin/receipts/{rid1}/pdf').content == good, 'final receipt is the stored, hash-checked file'

    # Customer mail: the stamped receipt is what gets attached.
    with Session() as db:
        dispatch(db, 'https://testserver')
    receipt_mails = [m for m in delivered if m[3] and m[3][0] == f'{receipt_number}.pdf']
    assert receipt_mails and receipt_mails[0][3][1] == good
    assert any('OFFICIALLY PAID' in (m[2] or '') or 'PARTIALLY PAID' in (m[2] or '') for m in delivered)

    # Tampering with the stored file is detected, not served.
    stored = next(Path(store).rglob('*.pdf'))
    stored.write_bytes(good + b'\n%tamper')
    assert c.get(f'/admin/receipts/{rid1}/pdf').status_code == 409

    # Second half settles the invoice completely.
    pid2, rid2 = pay_and_confirm(c, invoice_id, 6_000_000)
    with Session() as db:
        inv = db.get(Invoice, invoice_id)
        assert (inv.status, inv.outstanding_minor) == ('paid', 0)
        confirmed = sum(p.amount_minor for p in db.query(Payment).filter_by(invoice_id=invoice_id, status='recorded'))
        assert confirmed == inv.total_minor
        inv_token = db.query(Verification).filter_by(kind='invoice', document_id=invoice_id).one().token
    assert 'OFFICIALLY PAID' in c.get(f'/verify/{inv_token}').text
    text = ' '.join((p.extract_text() or '') for p in PdfReader(io.BytesIO(c.get(f'/admin/invoices/{invoice_id}/pdf').content)).pages)
    assert 'OFFICIALLY PAID' in text
    # Nothing can be paid twice, and a paid invoice cannot be voided around its receipts.
    assert c.post(f'/admin/invoices/{invoice_id}/payment', data={'csrf': csrf(c), 'amount': '1', 'date': date.today().isoformat(), 'method': 'Cheque'}).status_code == 422
    assert c.post(f'/admin/invoices/{invoice_id}/status', data={'csrf': csrf(c), 'action': 'void'}).status_code == 409


def test_small_payment_receipt_is_released_immediately_and_invoice_says_it_is_not_proof(finance):
    c, delivered, _ = finance
    invoice_id, _ = make_invoice(1_500_000)
    text = ' '.join((p.extract_text() or '') for p in PdfReader(io.BytesIO(c.get(f'/admin/invoices/{invoice_id}/pdf').content)).pages)
    assert 'PAYMENT REQUEST - NOT PROOF OF PAYMENT' in text and 'official VORA receipt' in text
    assert 'AWAITING PAYMENT' in text
    _, rid = pay_and_confirm(c, invoice_id, 1_500_000)
    with Session() as db:
        rec = db.get(Receipt, rid)
        assert rec.status == 'issued' and not rec.stamp_required
    receipt_text = ' '.join((p.extract_text() or '') for p in PdfReader(io.BytesIO(c.get(f'/admin/receipts/{rid}/pdf').content)).pages)
    assert 'OFFICIAL PAYMENT RECEIPT' in receipt_text and 'cleared funds' in receipt_text
    with Session() as db:
        dispatch(db, 'https://testserver')
    assert any(m[0] == 'settle@example.invalid' and m[3] for m in delivered)


def test_foreign_currency_receipts_always_need_manual_stamp_review(finance):
    c, _, _ = finance
    invoice_id, _ = make_invoice(100, currency='USD')
    _, rid = pay_and_confirm(c, invoice_id, 100)
    with Session() as db:
        assert db.get(Receipt, rid).status == 'pending_stamp'
