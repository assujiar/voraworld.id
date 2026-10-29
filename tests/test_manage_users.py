"""Account administration CLI: creation, role changes, password reset invalidating sessions."""
import importlib.util, io, sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from test_e2e import csrf, prepare_schema
from vora.db import Session, User, Audit
from vora.main import app, password_valid

SCRIPT = Path(__file__).resolve().parents[1] / 'scripts' / 'manage_users.py'
spec = importlib.util.spec_from_file_location('manage_users', SCRIPT)
manage = importlib.util.module_from_spec(spec); spec.loader.exec_module(manage)


def run(monkeypatch, argv, password=None):
    if password is not None:
        monkeypatch.setattr(sys, 'stdin', io.StringIO(password + '\n'))
    return manage.main(argv)


def test_create_reset_role_and_deactivate_flow(monkeypatch, capsys):
    prepare_schema()
    email = 'cli-user@invalid.example'
    assert run(monkeypatch, ['create', email, '--role', 'finance', '--password-stdin'], 'first-password-1234') == 0
    with Session() as db:
        user = db.query(User).filter_by(email=email).one()
        assert user.role == 'finance' and password_valid('first-password-1234', user.password_hash)
        assert 'first-password-1234' not in user.password_hash
    assert 'first-password-1234' not in capsys.readouterr().out
    with pytest.raises(SystemExit):
        run(monkeypatch, ['create', email, '--password-stdin'], 'another-password-1234')   # duplicates refused

    client = TestClient(app, headers={'x-real-ip': '203.0.113.77'})
    assert client.post('/admin/login', data={'csrf': csrf(client), 'email': email, 'password': 'first-password-1234'}, follow_redirects=False).status_code == 303
    assert client.get('/admin/invoices').status_code == 200

    run(monkeypatch, ['reset-password', email, '--password-stdin'], 'second-password-5678')
    assert client.get('/admin').status_code == 401, 'password reset must end the existing session'
    run(monkeypatch, ['set-role', email, 'viewer'])
    run(monkeypatch, ['deactivate', email])
    with Session() as db:
        user = db.query(User).filter_by(email=email).one()
        assert (user.role, user.active) == ('viewer', False) and password_valid('second-password-5678', user.password_hash)
        verbs = {a.verb for a in db.query(Audit).filter_by(object_type='user', object_id=user.id)}
        assert {'user-create', 'user-password-reset', 'user-role-change', 'user-deactivate'} <= verbs


def test_weak_password_and_bad_role_are_rejected(monkeypatch):
    prepare_schema()
    with pytest.raises(SystemExit):
        run(monkeypatch, ['create', 'weak@invalid.example', '--password-stdin'], 'short')
    with pytest.raises(SystemExit):
        manage.main(['create', 'x@invalid.example', '--role', 'root'])
    with Session() as db:
        assert db.query(User).filter_by(email='weak@invalid.example').count() == 0
