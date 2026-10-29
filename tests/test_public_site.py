"""Public website: routes, localization, brand/contact rules, SEO and security headers."""
import re
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
import test_e2e  # noqa: F401  (sets the isolated test database before vora.main loads)
from vora.main import app
from vora.content import SERVICE_GROUPS, SERVICE_MODES

ROOT = Path(__file__).resolve().parents[1]
CORE = ['/', '/about', '/services', '/solutions', '/network', '/insights', '/faq', '/contact', '/request-quote']
FORBIDDEN = re.compile(r'tel:|wa\.me|api\.whatsapp|whatsapp|href=["\']/(en/|id/)?admin', re.I)
APPROVED_EMAIL = 'info@voraworld.id'
APPROVED_ADDRESS = 'Gedung Nucira, Jl. Letjen M.T. Haryono Kav. 27, Tebet, Jakarta Selatan, DKI Jakarta 12810'


def all_public_paths():
    paths = list(CORE)
    for group, data in SERVICE_GROUPS.items():
        paths.append(f'/services/{group}')
        paths += [f'/services/{group}/{mode}' for mode in data['modes']]
    return paths


@pytest.fixture(scope='module')
def client():
    with TestClient(app) as c:
        yield c


def test_five_service_groups_and_nine_subservices():
    assert list(SERVICE_GROUPS) == ['international-freight-forwarding', 'customs-brokerage', '3pl-warehousing',
                                    'domestic-distribution', 'project-cargo']
    assert sum(len(g['modes']) for g in SERVICE_GROUPS.values()) == 9
    assert set(SERVICE_MODES['international-freight-forwarding']) == {'air-import', 'sea-import', 'air-export', 'sea-export'}
    assert set(SERVICE_MODES['domestic-distribution']) == {'ftl', 'ltl', 'fcl', 'lcl', 'air-freight'}


@pytest.mark.parametrize('locale', ['en', 'id'])
def test_every_public_page_renders_without_phone_whatsapp_or_admin_links(client, locale):
    for path in all_public_paths():
        r = client.get(f'/{locale}{path}')
        assert r.status_code == 200, (locale, path)
        assert not FORBIDDEN.search(r.text), (locale, path, FORBIDDEN.search(r.text).group(0))
        assert 'vora-primary.svg' in r.text
        assert f'<html lang="{locale}"' in r.text


def test_approved_company_details_are_published(client):
    from vora.db import Session, Setting
    from vora.defaults import PUBLIC_CONTACT_DEFAULTS
    assert PUBLIC_CONTACT_DEFAULTS['email'] == APPROVED_EMAIL and PUBLIC_CONTACT_DEFAULTS['address'] == APPROVED_ADDRESS
    assert not any(k in PUBLIC_CONTACT_DEFAULTS for k in ('phone', 'whatsapp'))
    migration = (ROOT / 'migrations/0002_contact_details.sql').read_text()
    assert APPROVED_EMAIL in migration and APPROVED_ADDRESS in migration
    # Other tests edit these settings through the admin; check the shipped defaults on a clean slate, then restore.
    with Session() as db:
        saved = {r.key: r.value for r in db.query(Setting).filter(Setting.key.in_(['email', 'address'])).all()}
        db.query(Setting).filter(Setting.key.in_(['email', 'address'])).delete(synchronize_session=False)
        db.commit()
    try:
        for locale in ('en', 'id'):
            text = client.get(f'/{locale}/contact').text
            assert APPROVED_EMAIL in text and APPROVED_ADDRESS in text
            assert 'PT Satu Arah International' in text
    finally:
        with Session() as db:
            for key, value in saved.items():
                db.add(Setting(key=key, value=value))
            db.commit()


def test_indonesian_locale_is_translated_not_just_labelled(client):
    contact = client.get('/id/contact').text
    for expected in ('Hubungi kami', 'Pesan', 'Perusahaan', 'Kirim permintaan', 'pemberitahuan privasi'):
        assert expected in contact, expected
    home = client.get('/id/').text
    for expected in ('Tentang', 'Layanan', 'Kontak', 'Wawasan', 'Pengiriman berikutnya', 'PENDEKATAN VORA'):
        assert expected in home, expected
    # Core English UI strings must not leak into the Indonesian pages.
    leaked = ['Who we are', 'Get in touch', 'Where are you going next?', 'Select a service', 'Request for quotation', 'Our thinking']
    for path in ('/', '/about', '/contact', '/request-quote', '/solutions', '/network', '/faq'):
        body = client.get('/id' + path).text
        for phrase in leaked:
            assert phrase not in body, (path, phrase)
    assert 'Manufaktur' in client.get('/id/solutions').text
    assert '<title>VORA | Membawa Dunia Lebih Dekat</title>' in home
    assert 'Tentang VORA' in client.get('/id/about').text


def test_public_pages_do_not_mention_the_admin_portal(client):
    for path in ('/en/insights', '/en/contact', '/id/insights', '/en/privacy'):
        body = client.get(path).text.lower()
        assert 'admin portal' not in body and 'administrator' not in body


def test_seo_basics(client):
    r = client.get('/en/services/international-freight-forwarding/air-import')
    assert '<link rel="canonical"' in r.text
    assert 'hreflang="id"' in r.text and 'hreflang="en"' in r.text
    assert 'application/ld+json' in r.text and re.search(r'"@type"\s*:\s*"Service"', r.text)
    sitemap = client.get('/sitemap.xml').text
    assert '/en/services/domestic-distribution' in sitemap and '/id/services/domestic-distribution' in sitemap
    robots = client.get('/robots.txt').text
    assert 'Disallow: /admin' in robots and 'Disallow: /verify' in robots and 'Sitemap:' in robots
    assert client.get('/en/admin').status_code == 404  # no public admin path under a locale
    assert client.get('/xx/').status_code == 404
    assert client.get('/en/does-not-exist').status_code == 404


def test_legacy_service_aliases_redirect_permanently(client):
    r = client.get('/en/services/sea-freight', follow_redirects=False)
    assert r.status_code == 301 and r.headers['location'] == '/en/services/international-freight-forwarding/sea-export'


def test_security_headers_present_on_public_and_admin(client):
    for path in ('/en/', '/admin/login', '/robots.txt'):
        h = client.get(path).headers
        assert h['x-content-type-options'] == 'nosniff' and h['x-frame-options'] == 'DENY'
        csp = h['content-security-policy']
        assert "frame-ancestors 'none'" in csp and "object-src 'none'" in csp and "default-src 'self'" in csp
    assert 'noindex' in client.get('/admin/login').headers['x-robots-tag']


def test_standard_cursor_and_no_pointer_tracking():
    css = ''.join(p.read_text() for p in (ROOT / 'vora/static/css').glob('*.css'))
    js = ''.join(p.read_text() for p in (ROOT / 'vora/static/js').glob('*.js'))
    assert not re.search(r'cursor\s*:\s*(none|url)', css)
    assert not re.search(r'mousemove|pointermove', js)


def test_motion_respects_reduced_motion_preference():
    css = (ROOT / 'vora/static/css/motion.css').read_text() + (ROOT / 'vora/static/css/experience.css').read_text()
    js = (ROOT / 'vora/static/js/experience.js').read_text()
    assert 'prefers-reduced-motion' in css
    assert 'prefers-reduced-motion' in js or 'reduced' in js.lower()


def test_brand_assets_are_the_official_files():
    for name in ('vora-primary.svg', 'vora-reverse.svg', 'vora-a-icon-primary.svg', 'vora-a-watermark.png', 'design-tokens.json'):
        assert (ROOT / 'vora/static/assets' / name).stat().st_size > 100, name
    tokens = (ROOT / 'vora/static/assets/design-tokens.json').read_text().lower()
    assert '#b43e31' in tokens and '#101720' in tokens


def test_admin_mobile_menu_toggle_is_reachable():
    """Regression: on <=780px the sidebar is collapsed by script and its Menu toggle must be shown."""
    css = (ROOT / 'vora/static/css/site.css').read_text()
    match = re.search(r'@media\(max-width:780px\)\{\.admin-sidebar details>summary\.sidebar-toggle\{([^}]*)\}', css)
    assert match and 'display:block' in match.group(1)
