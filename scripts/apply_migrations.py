"""Apply migrations/*.sql to the PostgreSQL database in DATABASE_URL, in numeric order.

Dry run by default: prints which migrations are pending. Pass --apply to execute them.
Applied files are recorded in a schema_migrations table, so re-running is safe.
Each file runs in its own transaction; a failure rolls that file back and stops.

A database that already has VORA tables but no schema_migrations table (set up by hand from the SQL
files) is refused; record what it already contains with --baseline NNNN (e.g. --baseline 0009).

Usage: python scripts/apply_migrations.py [--apply] [--baseline NNNN]
"""
import argparse, hashlib, os, sys
from pathlib import Path
import psycopg

MIGRATIONS = Path(__file__).resolve().parents[1] / 'migrations'

def connection_url():
    url = os.getenv('DATABASE_URL', '')
    for prefix in ('postgresql+psycopg://', 'postgres://'):
        if url.startswith(prefix):
            url = 'postgresql://' + url[len(prefix):]
    if not url.startswith('postgresql://'):
        raise SystemExit('DATABASE_URL must be a PostgreSQL URL')
    return url

def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    ap.add_argument('--apply', action='store_true', help='execute pending migrations (default: dry run)')
    ap.add_argument('--baseline', metavar='NNNN', help='mark migrations up to and including NNNN as already applied')
    args = ap.parse_args()
    files = sorted(MIGRATIONS.glob('[0-9][0-9][0-9][0-9]_*.sql'))
    if not files:
        raise SystemExit('No migrations found')
    # prepare_threshold=None keeps this working through the Supabase transaction pooler as well.
    with psycopg.connect(connection_url(), prepare_threshold=None, autocommit=True) as conn:
        tracked = conn.execute("select to_regclass('public.schema_migrations') is not null").fetchone()[0]
        if not tracked:
            populated = conn.execute("select to_regclass('public.users') is not null").fetchone()[0]
            if populated and not args.baseline:
                raise SystemExit('Database already has VORA tables but no schema_migrations record. '
                                 'Check which migrations it contains, then re-run with --baseline NNNN.')
            if args.apply or args.baseline:
                conn.execute('create table schema_migrations (name text primary key, sha256 text not null, '
                             'applied_at timestamptz not null default now())')
                conn.execute('alter table schema_migrations enable row level security')  # keep it off the Supabase Data API
        done = {}
        if tracked or args.apply or args.baseline:
            done = dict(conn.execute('select name, sha256 from schema_migrations').fetchall())
        for f in files:
            sha = hashlib.sha256(f.read_bytes()).hexdigest()
            if f.name in done:
                if done[f.name] != sha:
                    print(f'WARNING {f.name} changed since it was applied')
                continue
            if args.baseline and f.name[:4] <= args.baseline:
                conn.execute('insert into schema_migrations(name, sha256) values (%s, %s)', (f.name, sha))
                print(f'baselined {f.name}')
                continue
            if not args.apply:
                print(f'pending  {f.name}')
                continue
            with conn.transaction():
                conn.execute(f.read_text())
                conn.execute('insert into schema_migrations(name, sha256) values (%s, %s)', (f.name, sha))
            print(f'applied  {f.name}')
    if not args.apply:
        print('Dry run only. Re-run with --apply to execute.')

if __name__ == '__main__':
    main()
