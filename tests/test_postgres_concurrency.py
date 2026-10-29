"""Concurrency guarantees that only a real PostgreSQL server can prove.

Skipped on SQLite. Run with VORA_TEST_DATABASE_URL pointing at a freshly migrated database (see QA_REPORT.md).
"""
import threading
from datetime import date
import pytest
from fastapi.testclient import TestClient
from test_e2e import csrf, prepare_schema
from test_security import make_user, signed_in
from test_finance_extras import make_invoice
from vora.db import Session, Customer, Invoice, Payment, Receipt, engine
from vora.logic import ensure_public_code, next_number
from vora.main import app

pytestmark = pytest.mark.skipif(engine.dialect.name != 'postgresql', reason='needs PostgreSQL row/advisory locks')


def run_threads(fn, count):
    results, errors, barrier = [], [], threading.Barrier(count)
    def worker(i):
        try:
            barrier.wait(timeout=10)
            results.append(fn(i))
        except Exception as exc:  # noqa: BLE001 - collected and asserted below
            errors.append(repr(exc))
    threads = [threading.Thread(target=worker, args=(i,)) for i in range(count)]
    [t.start() for t in threads]; [t.join(timeout=60) for t in threads]
    return results, errors


def test_parallel_invoice_numbers_are_unique_and_well_formed():
    prepare_schema()
    with Session() as db:
        customer = Customer(name='CONCURRENCY QA', currency='IDR'); db.add(customer); db.flush()
        code = ensure_public_code(db, customer); customer_id = customer.id; db.commit()

    def issue(i):
        with Session() as db:  # one transaction per "request": allocate, insert, commit
            number = next_number(db, 'INV', code, date.today().isoformat())
            db.add(Invoice(number=number, customer_id=customer_id, issued_at=date.today().isoformat(), due_at=date.today().isoformat(),
                           status='issued', currency='IDR', subtotal_minor=1, total_minor=1, outstanding_minor=1))
            db.commit()
            return number

    numbers, errors = run_threads(issue, 16)
    assert not errors, errors
    assert len(numbers) == 16 and len(set(numbers)) == 16
    suffix = date.today().strftime('%Y%m')
    assert all(n.startswith(f'INV-VORA-{code}-{suffix}-') and len(n.rsplit('-', 1)[1]) == 5 for n in numbers)


def test_database_rejects_duplicate_document_numbers():
    from sqlalchemy.exc import IntegrityError
    invoice_id, number = make_invoice(1_000)
    with Session() as db:
        customer_id = db.get(Invoice, invoice_id).customer_id
        db.add(Invoice(number=number, customer_id=customer_id, issued_at='2026-01-01', status='issued', currency='IDR',
                       subtotal_minor=1, total_minor=1, outstanding_minor=1))
        with pytest.raises(IntegrityError):
            db.commit()


def test_simultaneous_confirmation_of_one_payment_succeeds_exactly_once(monkeypatch):
    monkeypatch.setattr('vora.main._notify_cleared_payment', lambda *_: {'sent': 0, 'failed': 0})
    prepare_schema(); make_user('race@settle.invalid', 'finance')
    invoice_id, _ = make_invoice(2_000_000)
    admin = signed_in('race@settle.invalid')
    r = admin.post(f'/admin/invoices/{invoice_id}/payment', data={'csrf': csrf(admin), 'amount': '2000000', 'date': date.today().isoformat(), 'method': 'Cheque'}, follow_redirects=False)
    assert r.status_code == 303
    with Session() as db:
        pid = db.query(Payment).filter_by(invoice_id=invoice_id).one().id
    cookies, token = dict(admin.cookies), csrf(admin)

    def confirm(_):
        with TestClient(app, cookies=cookies) as c:
            return c.post(f'/admin/payments/{pid}/confirm', data={'csrf': token, 'funds_cleared': 'yes'}, follow_redirects=False).status_code

    codes, errors = run_threads(confirm, 6)
    assert not errors, errors
    assert sorted(codes) == [303] + [409] * 5, codes
    with Session() as db:
        assert db.query(Receipt).filter_by(payment_id=pid).count() == 1
        inv = db.get(Invoice, invoice_id)
        assert (inv.status, inv.outstanding_minor) == ('paid', 0)
