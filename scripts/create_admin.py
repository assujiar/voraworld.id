"""One-time superadmin creation. Usage: python scripts/create_admin.py EMAIL

Thin wrapper kept for backwards compatibility; see scripts/manage_users.py for roles, resets and deactivation.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from manage_users import main  # noqa: E402

if __name__ == '__main__':
    email = sys.argv[1] if len(sys.argv) > 1 else input('Admin email: ').strip()
    raise SystemExit(main(['create', email, '--role', 'superadmin']))
