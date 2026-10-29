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
