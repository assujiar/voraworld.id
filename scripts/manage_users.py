"""Administer VORA admin accounts from a trusted machine (there is deliberately no HTTP endpoint for this).

  python scripts/manage_users.py create EMAIL --role superadmin
  python scripts/manage_users.py reset-password EMAIL
  python scripts/manage_users.py set-role EMAIL ROLE
  python scripts/manage_users.py deactivate EMAIL | activate EMAIL
  python scripts/manage_users.py list

DATABASE_URL (and the app's other variables) must be set in the environment. The password is requested
interactively and never printed; for automation pass --password-stdin and pipe it in.
Resetting a password or deactivating an account ends that user's existing sessions immediately.
Roles: superadmin, admin, editor, sales, finance, viewer.
"""
import argparse, getpass, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from vora.db import Session, User, Audit  # noqa: E402
from vora.main import password_hash, ROLES  # noqa: E402

MIN_PASSWORD = 14


def read_password(args):
    if args.password_stdin:
        password = sys.stdin.readline().rstrip('\r\n')
    else:
        password = getpass.getpass(f'New password (min {MIN_PASSWORD} characters): ')
        if password != getpass.getpass('Repeat password: '):
            raise SystemExit('Passwords do not match')
    if len(password) < MIN_PASSWORD:
        raise SystemExit(f'Password must be at least {MIN_PASSWORD} characters')
    return password


def audit(db, verb, user, note=''):
    db.add(Audit(actor_id=None, verb=verb, object_type='user', object_id=user.id, summary=f'{user.email} {note}'.strip()[:1000]))


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest='command', required=True)
    c = sub.add_parser('create'); c.add_argument('email'); c.add_argument('--role', default='superadmin', choices=sorted(ROLES)); c.add_argument('--password-stdin', action='store_true')
    r = sub.add_parser('reset-password'); r.add_argument('email'); r.add_argument('--password-stdin', action='store_true')
    s = sub.add_parser('set-role'); s.add_argument('email'); s.add_argument('role', choices=sorted(ROLES))
    for name in ('deactivate', 'activate'):
        sub.add_parser(name).add_argument('email')
    sub.add_parser('list')
    args = ap.parse_args(argv)
    with Session() as db:
        if args.command == 'list':
            for u in db.query(User).order_by(User.id):
                print(f'{u.id:>4}  {u.email:<40} {u.role:<11} {"active" if u.active else "DISABLED"}')
            return 0
        email = args.email.strip().lower()
        if '@' not in email:
            raise SystemExit('A valid email address is required')
        user = db.query(User).filter_by(email=email).first()
        if args.command == 'create':
            if user:
                raise SystemExit('Account already exists (use reset-password or set-role)')
            user = User(email=email, password_hash=password_hash(read_password(args)), role=args.role, active=True)
            db.add(user); db.flush(); audit(db, 'user-create', user, f'role={args.role}')
            print(f'{args.role} account created for {email} (no credentials printed).')
        else:
            if not user:
                raise SystemExit('No such account')
            if args.command == 'reset-password':
                user.password_hash = password_hash(read_password(args)); audit(db, 'user-password-reset', user)
                print('Password reset; all existing sessions for this account are now invalid.')
            elif args.command == 'set-role':
                user.role = args.role; audit(db, 'user-role-change', user, f'role={args.role}'); print(f'Role set to {args.role}.')
            elif args.command in ('deactivate', 'activate'):
                user.active = args.command == 'activate'; audit(db, f'user-{args.command}', user); print(f'Account {args.command}d.')
        db.commit()
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
