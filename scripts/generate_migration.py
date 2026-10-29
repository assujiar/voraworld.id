"""Regenerate baseline PostgreSQL SQL from declared SQLAlchemy models (manual review before changes)."""
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from sqlalchemy.schema import CreateTable,CreateIndex
from sqlalchemy.dialects import postgresql
from vora.db import Base
p=Path(__file__).resolve().parents[1]/'migrations'/'0001_initial_postgres.sql'
with p.open('w') as f:
 f.write('-- VORA initial PostgreSQL/Supabase schema\n-- Apply on a NEW database via Supabase SQL editor or psql.\n-- Do not reapply on existing data. No demo users/data are created.\nBEGIN;\n')
 for table in Base.metadata.sorted_tables:
  f.write(str(CreateTable(table).compile(dialect=postgresql.dialect()))+';\n\n')
 for table in Base.metadata.sorted_tables:
  for idx in sorted(table.indexes,key=lambda x:x.name):
   f.write(str(CreateIndex(idx).compile(dialect=postgresql.dialect()))+';\n')
 f.write('COMMIT;\n')
print(p)
