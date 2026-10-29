"""SMTP test message, delivery log, automatic backoff and manual retry (SMTP network is faked; the rest is real)."""
from datetime import timedelta
import pytest
from fastapi.testclient import TestClient
from test_e2e import csrf, prepare_schema
from test_security import make_user, signed_in
from vora.db import Session, MailConfig, EmailJob, EmailRule, Audit, now
from vora.mail import enqueue, dispatch


@pytest.fixture()
def mail(monkeypatch):
    prepare_schema()
    sent, mode = [], {'fail': False}
    def fake_smtp(conf, to, subject, body, attachment=None):
        if mode['fail']:
            raise ConnectionRefusedError('smtp.example.invalid refused the connection')
        sent.append((to, subject))
    monkeypatch.setattr('vora.mail.send_smtp', fake_smtp)
    monkeypatch.setattr('vora.main._notify_cleared_payment', lambda *_: dispatch_now())
    def dispatch_now():
        with Session() as db:
            return dispatch(db, 'https://testserver')
    with Session() as db:
        conf = db.get(MailConfig, 1) or MailConfig(id=1)
        db.add(conf); conf.host = 'smtp.example.invalid'; conf.port = 587; conf.security = 'starttls'
        conf.from_email = 'info@voraworld.id'; conf.admin_email = 'ops@example.invalid'; conf.enabled = True
        db.commit()
    make_user('settings@mail.invalid', 'admin'); make_user('finance@mail.invalid', 'finance')
    return sent, mode, signed_in('settings@mail.invalid')


def test_smtp_test_email_success_failure_and_permissions(mail, monkeypatch):
    sent, mode, admin = mail
    r = admin.post('/admin/mail/test', data={'csrf': csrf(admin)}, follow_redirects=False)
    assert r.status_code == 303 and 'Test email sent' in r.headers['location'].replace('%20', ' ')
    assert sent == [('ops@example.invalid', 'VORA SMTP test')]
    mode['fail'] = True
    r = admin.post('/admin/mail/test', data={'csrf': csrf(admin)}, follow_redirects=False)
    assert 'SMTP%20test%20failed' in r.headers['location'] and 'ConnectionRefusedError' in r.headers['location']
    with Session() as db:
        assert db.query(Audit).filter_by(verb='smtp-test').count() >= 2
    finance = signed_in('finance@mail.invalid')
    assert finance.post('/admin/mail/test', data={'csrf': csrf(finance)}).status_code == 403
    with Session() as db:
        db.get(MailConfig, 1).enabled = False; db.commit()
    assert admin.post('/admin/mail/test', data={'csrf': csrf(admin)}).status_code == 409


def test_failed_message_backs_off_then_can_be_retried_manually(mail):
    sent, mode, admin = mail
    mode['fail'] = True
    with Session() as db:
        db.get(EmailRule, 'lead_reply').enabled = True
        job = enqueue(db, 'lead_reply', 'customer@example.invalid', dict(name='Ana', lead_id='1', reply_message='Hello'), dedupe_key='retry-test-1')
        db.commit(); job_id = job.id
    # Five automatic attempts with growing back-off, then the message is parked as failed.
    for attempt in range(1, 6):
        with Session() as db:
            db.get(EmailJob, job_id).next_attempt_at = now() - timedelta(seconds=1); db.commit()
            assert dispatch(db, 'https://testserver')['failed'] >= 1
            row = db.get(EmailJob, job_id)
            assert row.attempts == attempt and row.status == ('failed' if attempt == 5 else 'retry')
            assert 'refused' in row.error
    page = admin.get('/admin/mail').text
    assert f'/admin/mail/jobs/{job_id}/retry' in page and 'Retry' in page
    # Still failing: the manual retry runs once and parks it again.
    assert admin.post(f'/admin/mail/jobs/{job_id}/retry', data={'csrf': csrf(admin)}, follow_redirects=False).status_code == 303
    with Session() as db:
        assert db.get(EmailJob, job_id).status == 'retry' and db.get(EmailJob, job_id).attempts == 1
    # The provider recovers: retry again, and it is delivered.
    mode['fail'] = False
    with Session() as db:
        db.get(EmailJob, job_id).next_attempt_at = now() - timedelta(seconds=1); db.commit()
    assert admin.post(f'/admin/mail/jobs/{job_id}/retry', data={'csrf': csrf(admin)}, follow_redirects=False).status_code == 303
    with Session() as db:
        row = db.get(EmailJob, job_id)
        assert row.status == 'sent' and row.sent_at is not None and row.error == ''
    assert ('customer@example.invalid', 'Regarding your VORA inquiry #1') in sent
    # A delivered message cannot be re-sent through the retry endpoint, and it needs the settings permission.
    assert admin.post(f'/admin/mail/jobs/{job_id}/retry', data={'csrf': csrf(admin)}).status_code == 409
    finance = signed_in('finance@mail.invalid')
    assert finance.post(f'/admin/mail/jobs/{job_id}/retry', data={'csrf': csrf(finance)}).status_code == 403
    assert admin.post('/admin/mail/jobs/999999/retry', data={'csrf': csrf(admin)}).status_code == 404


def test_duplicate_events_are_not_queued_twice(mail):
    with Session() as db:
        db.get(EmailRule, 'lead_reply').enabled = True
        a = enqueue(db, 'lead_reply', 'dup@example.invalid', dict(name='A', lead_id='2', reply_message='x'), dedupe_key='dup-key-1')
        b = enqueue(db, 'lead_reply', 'dup@example.invalid', dict(name='A', lead_id='2', reply_message='x'), dedupe_key='dup-key-1')
        db.commit()
        assert db.query(EmailJob).filter_by(recipient='dup@example.invalid').count() == 1
