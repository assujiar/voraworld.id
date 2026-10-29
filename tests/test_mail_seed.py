"""Production never runs init_db(), so SQL migrations must seed every email event the code can trigger."""
import re
from pathlib import Path
from vora.mail import EVENTS

MIGRATION = Path(__file__).resolve().parents[1] / 'migrations' / '0014_seed_email_templates.sql'


def test_seed_migration_matches_code_exactly():
    sql = MIGRATION.read_text()
    rows = re.findall(r"\('(\w+)', \$vora\$(.*?)\$vora\$, \$vora\$(.*?)\$vora\$\)", sql, re.S)
    assert {k: (s, h) for k, s, h in rows} == EVENTS
    rules = re.findall(r"^\s+\('(\w+)', FALSE\)", sql, re.M)
    assert sorted(rules) == sorted(EVENTS)
    assert 'ON CONFLICT (key) DO NOTHING' in sql  # admin edits must survive re-runs


def test_every_event_the_code_enqueues_has_a_template():
    root = Path(__file__).resolve().parents[1] / 'vora'
    used = set(re.findall(r"enqueue\(\s*\w+\s*,\s*'(\w+)'", ''.join(p.read_text() for p in root.glob('*.py'))))
    assert used and used <= set(EVENTS), used - set(EVENTS)
