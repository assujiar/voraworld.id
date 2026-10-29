"""Vercel + Supabase deployment-compatibility checks. No network or Postgres server required."""
import json, importlib, sys
from pathlib import Path
import pytest
from sqlalchemy.pool import NullPool

ROOT = Path(__file__).resolve().parents[1]
PG = 'postgresql+psycopg://user:pw@aws-0-region.pooler.supabase.com:6543/postgres?sslmode=require'

def test_pooler_safe_engine_options(monkeypatch):
    from vora.db import _engine_options
    monkeypatch.delenv('VERCEL', raising=False)
    monkeypatch.delenv('DB_NULL_POOL', raising=False)
    opts = _engine_options(PG)
    assert opts['connect_args'] == {'prepare_threshold': None}  # PgBouncer transaction mode
    assert 'poolclass' not in opts
    monkeypatch.setenv('VERCEL', '1')
    assert _engine_options(PG)['poolclass'] is NullPool
    assert 'check_same_thread' in _engine_options('sqlite:///./x.db')['connect_args']

def test_vercel_requires_production_mode(monkeypatch):
    monkeypatch.setenv('VERCEL', '1')
    monkeypatch.setenv('APP_ENV', 'development')
    saved = sys.modules.pop('vora.main', None)
    try:
        with pytest.raises(RuntimeError, match='APP_ENV=production'):
            importlib.import_module('vora.main')
    finally:
        sys.modules.pop('vora.main', None)
        if saved is not None:
            sys.modules['vora.main'] = saved

def test_upload_limit_fits_vercel_body_limit(monkeypatch):
    monkeypatch.setenv('VERCEL', '1')
    monkeypatch.delenv('MAX_UPLOAD_BYTES', raising=False)
    import vora.receipt_stamp as rs
    try:
        importlib.reload(rs)
        assert rs.MAX_STAMPED_PDF < 4_500_000
    finally:
        monkeypatch.delenv('VERCEL')
        importlib.reload(rs)
    assert rs.MAX_STAMPED_PDF == 10 * 1024 * 1024

def test_vercel_json_uses_zero_config_python():
    cfg = json.loads((ROOT / 'vercel.json').read_text())
    assert 'builds' not in cfg and 'routes' not in cfg  # legacy keys disable project settings
    assert 'app/index.py' in cfg['functions']
    assert (ROOT / 'app' / 'index.py').exists() and (ROOT / '.python-version').exists()

def test_runtime_requirements_exclude_test_tools():
    names = {l.split('>')[0].split('[')[0].strip().lower() for l in (ROOT / 'requirements.txt').read_text().splitlines() if l.strip()}
    assert not names & {'pytest', 'httpx'}
    assert {'fastapi', 'psycopg', 'pypdf', 'reportlab'} <= names

def test_migrations_are_contiguous():
    nums = [int(p.name[:4]) for p in sorted((ROOT / 'migrations').glob('[0-9]*_*.sql'))]
    assert nums == list(range(1, len(nums) + 1))


def test_manual_setup_sql_is_current():
    import importlib.util
    spec = importlib.util.spec_from_file_location('build_manual_setup', ROOT / 'scripts' / 'build_manual_setup.py')
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    assert (ROOT / 'SUPABASE_MANUAL_SETUP.sql').read_text() == module.build(), 'run: python scripts/build_manual_setup.py'


def test_env_example_documents_every_variable_the_code_reads():
    import re
    code = ''.join(p.read_text() for d in ('vora', 'scripts', 'app') for p in (ROOT / d).glob('*.py'))
    read = set(re.findall(r"os\.(?:getenv|environ\.get)\(\s*'([A-Z][A-Z0-9_]+)'", code))
    read -= {'VERCEL'}  # injected by the platform, not configured by hand
    example = (ROOT / '.env.example').read_text()
    documented = set(re.findall(r'^#?\s*([A-Z][A-Z0-9_]+)=', example, re.M))
    assert read <= documented, f'undocumented: {sorted(read - documented)}'
    stale = documented - read - {'VORA_TEST_DATABASE_URL'}
    assert not stale, f'documented but unused: {sorted(stale)}'


def test_vercel_cron_targets_the_authenticated_mail_dispatch_route():
    cfg = json.loads((ROOT / 'vercel.json').read_text())
    assert cfg['crons'], 'a retry safety-net cron is expected'
    for cron in cfg['crons']:
        assert cron['path'] == '/internal/mail/dispatch' and len(cron['schedule'].split()) == 5
    from vora.main import app
    assert any(getattr(r, 'path', None) == '/internal/mail/dispatch' and 'GET' in r.methods for r in app.routes)


def test_supabase_headers_support_legacy_jwt_and_new_secret_keys():
    from vora.receipt_stamp import supabase_headers
    legacy = 'eyJhbGciOiJIUzI1NiJ9.payload.signature'
    assert supabase_headers(legacy, 'image/png') == {'apikey': legacy, 'Authorization': 'Bearer ' + legacy, 'Content-Type': 'image/png'}
    new_key = 'sb_secret_' + 'a' * 22 + '_' + 'b' * 8
    headers = supabase_headers(new_key)
    assert headers == {'apikey': new_key}, 'sb_secret_ keys must never be sent as a Bearer token'


def test_storage_uploads_use_the_header_helper(monkeypatch):
    """Drive the real upload code with a fake HTTP layer and a new-style key."""
    import vora.receipt_stamp as rs
    seen = []
    class Resp:
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def read(self, *a): return b''
    monkeypatch.setenv('APP_ENV', 'production')
    monkeypatch.setenv('SUPABASE_URL', 'https://example.supabase.co')
    monkeypatch.setenv('SUPABASE_SERVICE_ROLE_KEY', 'sb_secret_' + 'a' * 22 + '_' + 'b' * 8)
    monkeypatch.setattr(rs.urllib.request, 'urlopen', lambda request, timeout=0: seen.append(request) or Resp())
    key = rs.save_stamped_pdf(7, b'%PDF-1.4 ' + b'x' * 400)
    rs.load_stamped_pdf(key)
    assert len(seen) == 2
    for request in seen:
        h = {k.lower(): v for k, v in request.header_items()}
        assert h['apikey'].startswith('sb_secret_') and 'authorization' not in h
    assert seen[0].full_url == f'https://example.supabase.co/storage/v1/object/vora-documents/{key}'
