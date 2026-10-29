"""Authentication, throttling, session binding, CSRF and the server-side role matrix."""
import itertools
import pytest
from fastapi.testclient import TestClient
from test_e2e import csrf, prepare_schema
from vora.main import app, password_hash, ROLES, LOGIN_MAX_PER_EMAIL
from vora.db import Session, User, LoginAttempt, Audit

PASSWORD = 'Role-Matrix-Pass-2026!'


@pytest.fixture(autouse=True, scope='module')
def _schema():
    prepare_schema()  # the schema is normally created by the app lifespan; make subsets runnable on their own
_ip = itertools.count(1)


def fresh_ip():
    return {'x-real-ip': f'198.51.100.{next(_ip)}'}


def make_user(email, role, password=PASSWORD, active=True):
    with Session() as db:
        user = db.query(User).filter_by(email=email).first()
        if not user:
            user = User(email=email, password_hash=password_hash(password), role=role, active=active)
            db.add(user)
        else:
            user.password_hash = password_hash(password); user.role = role; user.active = active
        db.commit()
        return user.id


def signed_in(email, headers=None):
    client = TestClient(app, headers=headers or fresh_ip())
    r = client.post('/admin/login', data={'csrf': csrf(client), 'email': email, 'password': PASSWORD}, follow_redirects=False)
    assert r.status_code == 303, r.text
    return client


def test_login_throttles_by_email_and_records_attempts():
    email = 'throttle@invalid.example'
    make_user(email, 'viewer')
    with TestClient(app, headers=fresh_ip()) as c:
        for _ in range(LOGIN_MAX_PER_EMAIL):
            r = c.post('/admin/login', data={'csrf': csrf(c), 'email': email, 'password': 'wrong-password'})
            assert r.status_code == 401
        # Even the correct password is refused while the window is saturated.
        r = c.post('/admin/login', data={'csrf': csrf(c), 'email': email, 'password': PASSWORD})
        assert r.status_code == 429 and 'Too many failed attempts' in r.text
    # A different account from another address is unaffected.
    make_user('unaffected@invalid.example', 'viewer')
    signed_in('unaffected@invalid.example')
    with Session() as db:
        assert db.query(LoginAttempt).filter_by(email=email, succeeded=False).count() == LOGIN_MAX_PER_EMAIL


def test_unknown_account_gets_same_response_as_wrong_password():
    with TestClient(app, headers=fresh_ip()) as c:
        a = c.post('/admin/login', data={'csrf': csrf(c), 'email': 'nobody@invalid.example', 'password': 'x' * 14})
        make_user('known@invalid.example', 'viewer')
        b = c.post('/admin/login', data={'csrf': csrf(c), 'email': 'known@invalid.example', 'password': 'y' * 14})
        assert a.status_code == b.status_code == 401
        assert 'Invalid login details' in a.text and 'Invalid login details' in b.text


def test_successful_login_is_audited_and_cookie_is_hardened():
    make_user('audited@invalid.example', 'viewer')
    c = TestClient(app, headers=fresh_ip())
    r = c.post('/admin/login', data={'csrf': csrf(c), 'email': 'audited@invalid.example', 'password': PASSWORD}, follow_redirects=False)
    cookie = r.headers['set-cookie'].lower()
    assert 'httponly' in cookie and 'samesite=lax' in cookie
    with Session() as db:
        assert db.query(Audit).filter_by(verb='login').count() >= 1


def test_logout_requires_post_and_csrf():
    make_user('logout@invalid.example', 'viewer')
    c = signed_in('logout@invalid.example')
    assert c.get('/admin/logout').status_code in (404, 405)  # GET can no longer sign anyone out
    assert c.post('/admin/logout', data={}).status_code == 403
    assert c.get('/admin').status_code == 200
    r = c.post('/admin/logout', data={'csrf': csrf(c)}, follow_redirects=False)
    assert r.status_code == 303
    c.cookies.delete('vora_session', path='/')  # the browser honours the expiring Set-Cookie
    assert c.get('/admin').status_code == 401


def test_session_dies_when_password_changes_or_account_is_disabled():
    email = 'rotate@invalid.example'
    make_user(email, 'admin')
    c = signed_in(email)
    assert c.get('/admin').status_code == 200
    make_user(email, 'admin', password='A-new-password-after-reset-1!')
    assert c.get('/admin').status_code == 401, 'old session must not survive a credential change'
    c2 = TestClient(app, headers=fresh_ip())
    make_user(email, 'admin', password=PASSWORD)
    c2.post('/admin/login', data={'csrf': csrf(c2), 'email': email, 'password': PASSWORD})
    assert c2.get('/admin').status_code == 200
    make_user(email, 'admin', active=False)
    assert c2.get('/admin').status_code == 401


def test_tampered_or_foreign_session_cookie_is_rejected():
    c = TestClient(app, headers=fresh_ip())
    c.cookies.set('vora_session', 'not-a-valid-token', path='/')
    assert c.get('/admin').status_code == 401


# endpoint -> permission it must require
READ_ENDPOINTS = {
    '/admin/articles': 'content', '/admin/pages': 'content', '/admin/media': 'content',
    '/admin/leads': 'crm',
    '/admin/customers': 'finance', '/admin/invoices': 'finance', '/admin/quotations': 'finance',
    '/admin/receipts': 'finance', '/admin/bank-accounts': 'finance',
    '/admin/settings': 'settings', '/admin/mail': 'settings', '/admin/audit': 'settings', '/admin/seo': 'settings',
}


@pytest.mark.parametrize('role', ['superadmin', 'admin', 'editor', 'sales', 'finance', 'viewer'])
def test_role_matrix_is_enforced_server_side(role):
    make_user(f'{role}@matrix.invalid', role)
    c = signed_in(f'{role}@matrix.invalid')
    grants = ROLES[role]
    for path, permission in READ_ENDPOINTS.items():
        status = c.get(path).status_code
        allowed = permission is None or '*' in grants or permission in grants
        assert status == (200 if allowed else 403), (role, path, status)
    assert c.get('/admin').status_code == 200  # every active user sees the overview


def test_state_changing_admin_posts_reject_missing_csrf():
    make_user('csrf@matrix.invalid', 'superadmin')
    c = signed_in('csrf@matrix.invalid')
    for path in ('/admin/settings', '/admin/faq', '/admin/navigation', '/admin/bank-accounts', '/admin/customers/new',
                 '/admin/invoices/new', '/admin/quotations/new', '/admin/articles/new', '/admin/pages/new'):
        r = c.post(path, data={'x': 'y'}, follow_redirects=False)
        assert r.status_code in (403, 422) and r.status_code != 303, (path, r.status_code)
        assert r.status_code == 403, path


def test_non_finance_roles_cannot_confirm_payments_or_mail_dispatch():
    for role in ('editor', 'sales', 'viewer'):
        make_user(f'{role}@fin.invalid', role)
        c = signed_in(f'{role}@fin.invalid')
        assert c.post('/admin/payments/1/confirm', data={'csrf': csrf(c), 'funds_cleared': 'yes'}).status_code == 403
        assert c.post('/admin/mail/dispatch', data={'csrf': csrf(c)}).status_code == 403
        assert c.post('/admin/invoices/1/payment', data={'csrf': csrf(c), 'amount': '1'}).status_code == 403


def admin_routes():
    from fastapi.routing import APIRoute
    exempt = {'/admin/login', '/admin/logout', '/admin'}
    seen = set()
    for route in app.routes:
        if isinstance(route, APIRoute) and route.path.startswith('/admin') and route.path not in exempt:
            for method in route.methods & {'GET', 'POST'}:
                seen.add((method, route.path))
    return sorted(seen)


def concrete(path):
    import re
    return re.sub(r'\{[^}]+\}', '1', path)


def test_every_admin_route_rejects_anonymous_and_unprivileged_users():
    """Enumerates the live route table, so a future route without an auth check fails the build."""
    routes = admin_routes()
    assert len(routes) > 60, len(routes)  # guard against the enumeration silently matching nothing
    make_user('viewer@allroutes.invalid', 'viewer')
    anon = TestClient(app, headers=fresh_ip())
    viewer = signed_in('viewer@allroutes.invalid')
    failures = []
    for method, path in routes:
        url = concrete(path)
        if method == 'GET':
            a, v = anon.get(url, follow_redirects=False), viewer.get(url, follow_redirects=False)
        else:
            kw = {'files': {'image': ('x.png', b'x', 'image/png')}} if path == '/admin/media' else {}  # FastAPI validates the upload field first
            a = anon.post(url, data={'csrf': csrf(anon), 'alt': 'x'}, follow_redirects=False, **kw)
            v = viewer.post(url, data={'csrf': csrf(viewer), 'alt': 'x'}, follow_redirects=False, **kw)
        if a.status_code != 401:
            failures.append(f'anonymous {method} {path} -> {a.status_code}')
        if v.status_code != 403:
            failures.append(f'viewer {method} {path} -> {v.status_code}')
    assert not failures, '\n'.join(failures)


def test_internal_and_customer_facing_endpoints_are_token_gated():
    c = TestClient(app, headers=fresh_ip())
    assert c.get('/internal/mail/dispatch').status_code == 401
    assert c.get('/internal/mail/dispatch', headers={'Authorization': 'Bearer short'}).status_code == 401
    assert c.get('/quotation-approval/not-a-real-token').status_code in (404, 410)
    assert c.get('/verify/not-a-real-token').status_code == 404
