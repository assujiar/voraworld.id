"""One-time admin account creation. Usage: python scripts/create_admin.py"""
import sys,getpass
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from vora.db import Session,User
from vora.main import password_hash

def main():
 email=input('Admin email: ').strip().lower()
 pw=getpass.getpass('New password (min 14 characters): ')
 if len(pw)<14 or '@' not in email:raise SystemExit('Valid email and password >=14 characters required')
 with Session() as db:
  if db.query(User).filter_by(email=email).first():raise SystemExit('Account already exists')
  u=User(email=email,password_hash=password_hash(pw),role='superadmin',active=True)
  db.add(u);db.commit()
 print('Superadmin account created (no credentials printed).')
if __name__=='__main__':main()
