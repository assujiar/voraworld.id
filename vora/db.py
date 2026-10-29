import os
from datetime import datetime, timezone
from sqlalchemy import create_engine, Column, Integer, String, Text, Boolean, DateTime, ForeignKey, UniqueConstraint, CheckConstraint, Index
from sqlalchemy.orm import DeclarativeBase, sessionmaker, relationship
from sqlalchemy.types import JSON

DB_URL=os.getenv('DATABASE_URL','sqlite:///./vora.db')
if DB_URL.startswith('postgres://'): DB_URL=DB_URL.replace('postgres://','postgresql+psycopg://',1)
if DB_URL.startswith('postgresql://'): DB_URL=DB_URL.replace('postgresql://','postgresql+psycopg://',1)
def _engine_options(url):
 if url.startswith('sqlite'):return {'connect_args':{'check_same_thread':False}}
 # Supabase's transaction pooler (PgBouncer, port 6543) rejects psycopg's automatic server-side
 # prepared statements, so they are disabled. Serverless instances (Vercel) should not hold their own
 # pool either: the Supabase pooler already multiplexes connections, and idle instances would leak them.
 opts={'connect_args':{'prepare_threshold':None}}
 if os.getenv('VERCEL') or os.getenv('DB_NULL_POOL')=='1':
  from sqlalchemy.pool import NullPool
  opts['poolclass']=NullPool
 return opts
engine=create_engine(DB_URL,pool_pre_ping=True,**_engine_options(DB_URL))
Session=sessionmaker(bind=engine,autoflush=False,expire_on_commit=False)
class Base(DeclarativeBase):pass
def now():return datetime.now(timezone.utc)
class User(Base):
 __tablename__='users'
 id=Column(Integer,primary_key=True);email=Column(String(200),unique=True,nullable=False);password_hash=Column(String(300),nullable=False);role=Column(String(30),nullable=False,default='viewer');active=Column(Boolean,default=True);created_at=Column(DateTime(timezone=True),default=now)
class Setting(Base):
 __tablename__='settings'
 key=Column(String(120),primary_key=True);value=Column(Text,nullable=False,default='');updated_at=Column(DateTime(timezone=True),default=now,onupdate=now)
class Page(Base):
 __tablename__='pages'
 id=Column(Integer,primary_key=True);slug=Column(String(160),unique=True,nullable=False);title=Column(String(200),nullable=False);description=Column(Text,default='');locale=Column(String(8),default='en');status=Column(String(20),default='draft');seo_title=Column(String(200),default='');seo_description=Column(Text,default='');updated_at=Column(DateTime(timezone=True),default=now,onupdate=now);published_snapshot=Column(JSON,nullable=True)
class Section(Base):
 __tablename__='sections'
 id=Column(Integer,primary_key=True);page_id=Column(Integer,ForeignKey('pages.id',ondelete='CASCADE'));position=Column(Integer,default=0);kind=Column(String(30),default='editorial');layout=Column(String(30),default='split');visible=Column(Boolean,default=True);title=Column(String(200),default='');body=Column(Text,default='');image=Column(String(500),default='');button_label=Column(String(120),default='');button_href=Column(String(400),default='');surface=Column(String(20),default='paper')
class Revision(Base):
 __tablename__='revisions'
 id=Column(Integer,primary_key=True);resource=Column(String(30));resource_id=Column(Integer);snapshot=Column(JSON);author_id=Column(Integer);created_at=Column(DateTime(timezone=True),default=now)
class Article(Base):
 __tablename__='articles'
 id=Column(Integer,primary_key=True);slug=Column(String(200),unique=True);title=Column(String(240));excerpt=Column(Text,default='');body=Column(Text,default='');category=Column(String(80),default='Updates');tags=Column(String(400),default='');locale=Column(String(8),default='en');status=Column(String(20),default='draft');cover=Column(String(500),default='');author=Column(String(120),default='Editorial Team');seo_title=Column(String(200),default='');seo_description=Column(String(300),default='');created_at=Column(DateTime(timezone=True),default=now);published_at=Column(DateTime(timezone=True));updated_at=Column(DateTime(timezone=True),default=now,onupdate=now)
class Faq(Base):
 __tablename__='faqs'
 id=Column(Integer,primary_key=True);question=Column(String(400),nullable=False);answer=Column(Text,nullable=False);service=Column(String(100),default='general');position=Column(Integer,default=0);visible=Column(Boolean,default=True)
class ServiceCoverage(Base):
 __tablename__='coverage'
 id=Column(Integer,primary_key=True);region=Column(String(160),nullable=False);mode=Column(String(100),default='enquiry');active=Column(Boolean,default=False);verified_at=Column(DateTime(timezone=True))
class Media(Base):
 __tablename__='media'
 id=Column(Integer,primary_key=True);filename=Column(String(250),nullable=False);storage_key=Column(String(500),nullable=False);url=Column(String(800),nullable=False);alt=Column(String(400),default='');category=Column(String(90),default='general');mime=Column(String(90));size=Column(Integer);created_at=Column(DateTime(timezone=True),default=now)
class Lead(Base):
 __tablename__='leads'
 id=Column(Integer,primary_key=True);public_code=Column(String(12),unique=True);reference=Column(String(90),unique=True);type=Column(String(20),default='contact');name=Column(String(140),nullable=False);company=Column(String(200),default='');email=Column(String(200),nullable=False);phone=Column(String(100),default='');message=Column(Text,default='');mode=Column(String(80),default='');origin=Column(String(160),default='');destination=Column(String(160),default='');cargo=Column(Text,default='');pickup=Column(String(60),default='');status=Column(String(30),default='new');priority=Column(String(20),default='normal');assignee=Column(String(160),default='');followup=Column(String(30),default='');source=Column(String(100),default='website');created_at=Column(DateTime(timezone=True),default=now);updated_at=Column(DateTime(timezone=True),default=now,onupdate=now)
class LeadActivity(Base):
 __tablename__='lead_activities'
 id=Column(Integer,primary_key=True);lead_id=Column(Integer,ForeignKey('leads.id',ondelete='CASCADE'));actor_id=Column(Integer);message=Column(Text,nullable=False);created_at=Column(DateTime(timezone=True),default=now)
class Customer(Base):
 __tablename__='customers'
 id=Column(Integer,primary_key=True);public_code=Column(String(12),unique=True);name=Column(String(200),nullable=False);email=Column(String(200),default='');phone=Column(String(100),default='');address=Column(Text,default='');tax_id=Column(String(100),default='');currency=Column(String(8),default='IDR');terms_days=Column(Integer,default=14);created_at=Column(DateTime(timezone=True),default=now)
class BankAccount(Base):
 __tablename__='bank_accounts'
 id=Column(Integer,primary_key=True)
 bank_name=Column(String(120),nullable=False)
 account_number=Column(String(60),nullable=False)
 account_holder=Column(String(200),nullable=False)
 currency=Column(String(8),nullable=False,default='IDR')
 branch=Column(String(150),default='')
 swift_code=Column(String(25),default='')
 notes=Column(String(250),default='')
 active=Column(Boolean,nullable=False,default=True)
 is_default=Column(Boolean,nullable=False,default=False)
 position=Column(Integer,nullable=False,default=0)
 created_at=Column(DateTime(timezone=True),default=now)
 updated_at=Column(DateTime(timezone=True),default=now,onupdate=now)
 __table_args__=(UniqueConstraint('bank_name','account_number',name='uq_bank_name_number'),)

class InvoiceBankInstruction(Base):
 __tablename__='invoice_bank_instructions'
 id=Column(Integer,primary_key=True)
 invoice_id=Column(Integer,ForeignKey('invoices.id',ondelete='CASCADE'),nullable=False)
 bank_account_id=Column(Integer,ForeignKey('bank_accounts.id',ondelete='RESTRICT'),nullable=False)
 bank_name=Column(String(120),nullable=False)
 account_number=Column(String(60),nullable=False)
 account_holder=Column(String(200),nullable=False)
 currency=Column(String(8),nullable=False)
 branch=Column(String(150),default='')
 swift_code=Column(String(25),default='')
 position=Column(Integer,nullable=False,default=0)
 __table_args__=(UniqueConstraint('invoice_id','bank_account_id',name='uq_invoice_bank_selection'),)

class Counter(Base):
 __tablename__='counters'
 id=Column(Integer,primary_key=True);kind=Column(String(20),nullable=False);period=Column(String(6),nullable=False);next_value=Column(Integer,default=1);__table_args__=(UniqueConstraint('kind','period'),)
class Quotation(Base):
 __tablename__='quotations'
 id=Column(Integer,primary_key=True)
 number=Column(String(90),unique=True,nullable=False)
 customer_id=Column(Integer,ForeignKey('customers.id'))
 lead_id=Column(Integer,ForeignKey('leads.id'))
 status=Column(String(20),default='draft')
 currency=Column(String(8),default='IDR')
 issued_at=Column(String(10),nullable=False)
 valid_until=Column(String(10),nullable=False)
 notes=Column(Text,default='')
 tax_percent=Column(String(20),default='0')
 subtotal_minor=Column(Integer,default=0)
 tax_minor=Column(Integer,default=0)
 total_minor=Column(Integer,default=0)
 created_at=Column(DateTime(timezone=True),default=now)
 customer=relationship('Customer')
 lead=relationship('Lead')
 items=relationship('QuotationItem',cascade='all, delete-orphan')
 __table_args__=(CheckConstraint('(customer_id IS NOT NULL AND lead_id IS NULL) OR (lead_id IS NOT NULL AND customer_id IS NULL)',name='quote_one_recipient'),)
class QuotationItem(Base):
 __tablename__='quotation_items'
 id=Column(Integer,primary_key=True)
 quotation_id=Column(Integer,ForeignKey('quotations.id',ondelete='CASCADE'),nullable=False)
 description=Column(String(500),nullable=False)
 unit=Column(String(30),default='unit')
 quantity=Column(String(30),nullable=False)
 price_minor=Column(Integer,nullable=False)
 amount_minor=Column(Integer,nullable=False)
class QuotationApproval(Base):
 __tablename__='quotation_approvals'
 id=Column(Integer,primary_key=True)
 quotation_id=Column(Integer,ForeignKey('quotations.id',ondelete='CASCADE'),nullable=False)
 token_hash=Column(String(64),unique=True,nullable=False)
 expires_at=Column(DateTime(timezone=True),nullable=False)
 status=Column(String(30),nullable=False,default='pending')
 signer_name=Column(String(180),default='')
 signer_title=Column(String(180),default='')
 signed_pdf_key=Column(String(500))
 signed_pdf_sha256=Column(String(64))
 uploaded_at=Column(DateTime(timezone=True))
 reviewed_at=Column(DateTime(timezone=True))
 reviewed_by=Column(Integer,ForeignKey('users.id'))
 review_note=Column(Text,default='')
 created_at=Column(DateTime(timezone=True),default=now)
 quotation=relationship('Quotation')

class Invoice(Base):
 __tablename__='invoices'
 id=Column(Integer,primary_key=True);number=Column(String(70),unique=True,nullable=False);customer_id=Column(Integer,ForeignKey('customers.id'),nullable=False);status=Column(String(30),default='draft');currency=Column(String(8),default='IDR');issued_at=Column(String(10));due_at=Column(String(10));po_number=Column(String(100),default='');shipment_reference=Column(String(120),default='');service_mode=Column(String(120),default='');origin=Column(String(180),default='');destination=Column(String(180),default='');transport_document_ref=Column(String(150),default='');notes=Column(Text,default='');tax_percent=Column(String(20),default='0');withholding_percent=Column(String(20),default='0');discount_minor=Column(Integer,default=0);subtotal_minor=Column(Integer,default=0);tax_minor=Column(Integer,default=0);withholding_minor=Column(Integer,default=0);total_minor=Column(Integer,default=0);outstanding_minor=Column(Integer,default=0);bank_instructions=relationship('InvoiceBankInstruction',order_by='InvoiceBankInstruction.position',cascade='all, delete-orphan');customer=relationship('Customer');items=relationship('InvoiceItem',cascade='all, delete-orphan');payments=relationship('Payment');created_at=Column(DateTime(timezone=True),default=now)
class InvoiceItem(Base):
 __tablename__='invoice_items'
 id=Column(Integer,primary_key=True);invoice_id=Column(Integer,ForeignKey('invoices.id',ondelete='CASCADE'));description=Column(String(500),nullable=False);unit=Column(String(30),default='unit');quantity=Column(String(30),nullable=False);price_minor=Column(Integer,nullable=False);amount_minor=Column(Integer,nullable=False)
class Payment(Base):
 __tablename__='payments'
 id=Column(Integer,primary_key=True);invoice_id=Column(Integer,ForeignKey('invoices.id'),nullable=False);amount_minor=Column(Integer,nullable=False);date=Column(String(10));method=Column(String(100),default='bank transfer');reference=Column(String(160),default='');receiving_bank_id=Column(Integer,ForeignKey('bank_accounts.id',ondelete='SET NULL'));receiving_bank_snapshot=Column(JSON);notes=Column(Text,default='');status=Column(String(30),nullable=False,default='pending_confirmation');confirmed_at=Column(DateTime(timezone=True));confirmed_by=Column(Integer,ForeignKey('users.id'));created_at=Column(DateTime(timezone=True),default=now)
class Receipt(Base):
 __tablename__='receipts'
 id=Column(Integer,primary_key=True);number=Column(String(70),unique=True,nullable=False);invoice_id=Column(Integer,ForeignKey('invoices.id'),nullable=False);payment_id=Column(Integer,ForeignKey('payments.id'),nullable=False,unique=True);status=Column(String(20),default='issued');stamp_required=Column(Boolean,nullable=False,default=False);stamp_storage_key=Column(String(500));stamp_sha256=Column(String(64));stamp_provider_reference=Column(String(160));stamp_uploaded_at=Column(DateTime(timezone=True));stamp_uploaded_by=Column(Integer,ForeignKey('users.id'));created_at=Column(DateTime(timezone=True),default=now)
class Verification(Base):
 __tablename__='document_verification_tokens'
 id=Column(Integer,primary_key=True);token_hash=Column(String(64),unique=True,nullable=False);token=Column(String(120),unique=True,nullable=False);kind=Column(String(20),nullable=False);document_id=Column(Integer,nullable=False);revoked=Column(Boolean,default=False);created_at=Column(DateTime(timezone=True),default=now)
class Audit(Base):
 __tablename__='audit_logs'
 id=Column(Integer,primary_key=True);actor_id=Column(Integer);verb=Column(String(90));object_type=Column(String(50));object_id=Column(Integer);summary=Column(Text,default='');created_at=Column(DateTime(timezone=True),default=now)
class LoginAttempt(Base):
 __tablename__='login_attempts'
 id=Column(Integer,primary_key=True);email=Column(String(200),nullable=False,index=True);ip=Column(String(64),nullable=False,default='',index=True);succeeded=Column(Boolean,nullable=False,default=False);created_at=Column(DateTime(timezone=True),default=now,index=True)
class MailConfig(Base):
 __tablename__='mail_config'
 id=Column(Integer,primary_key=True);host=Column(String(253),default='');port=Column(Integer,default=587);security=Column(String(20),default='starttls');username=Column(String(240),default='');encrypted_password=Column(Text,default='');from_email=Column(String(254),default='info@voraworld.id');from_name=Column(String(140),default='VORA Freight & Logistics');reply_to=Column(String(254),default='info@voraworld.id');admin_email=Column(String(254),default='info@voraworld.id');enabled=Column(Boolean,default=False)
class EmailTemplate(Base):
 __tablename__='email_templates'
 key=Column(String(60),primary_key=True);subject=Column(String(300),nullable=False);html=Column(Text,nullable=False);updated_at=Column(DateTime(timezone=True),default=now,onupdate=now)
class EmailRule(Base):
 __tablename__='email_rules'
 key=Column(String(60),primary_key=True);enabled=Column(Boolean,default=False)
class EmailJob(Base):
 __tablename__='email_jobs'
 id=Column(Integer,primary_key=True);event=Column(String(60),nullable=False);recipient=Column(String(254),nullable=False);subject=Column(String(300),nullable=False);html=Column(Text,nullable=False);status=Column(String(20),default='queued');attempts=Column(Integer,default=0);next_attempt_at=Column(DateTime(timezone=True),default=now);sent_at=Column(DateTime(timezone=True));error=Column(Text,default='');attachment_kind=Column(String(20));attachment_id=Column(Integer);dedupe_key=Column(String(160),unique=True);created_at=Column(DateTime(timezone=True),default=now)
class DocumentSeal(Base):
 __tablename__='document_seals'
 id=Column(Integer,primary_key=True);kind=Column(String(20),nullable=False);document_id=Column(Integer,nullable=False);fingerprint=Column(String(64),nullable=False);signature=Column(String(64),nullable=False);snapshot=Column(JSON,nullable=False);key_id=Column(String(40),default='v1');issued_at=Column(DateTime(timezone=True),default=now);__table_args__=(UniqueConstraint('kind','document_id'),)

class Redirect(Base):
 __tablename__='seo_redirects'
 id=Column(Integer,primary_key=True);old_path=Column(String(350),unique=True);new_path=Column(String(350));status=Column(Integer,default=301)
class Nav(Base):
 __tablename__='navigation_items'
 id=Column(Integer,primary_key=True);label=Column(String(100),nullable=False);href=Column(String(250),nullable=False);position=Column(Integer,default=0);location=Column(String(20),default='header');visible=Column(Boolean,default=True)
Index('ix_lead_status_date',Lead.status,Lead.created_at)
Index('ix_articles_status_published',Article.status,Article.published_at)
Index('ix_invoice_status',Invoice.status)

def init_db():
 Base.metadata.create_all(engine)
 # Local/development bootstrap. In production apply migrations/0002_contact_details.sql.
 from .defaults import PUBLIC_CONTACT_DEFAULTS
 with Session() as db:
  for key,value in PUBLIC_CONTACT_DEFAULTS.items():
   if db.get(Setting,key) is None: db.add(Setting(key=key,value=value))
  from .mail import bootstrap
  bootstrap(db)
  db.commit()
def db_dep():
 with Session() as db:yield db
