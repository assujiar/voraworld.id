"""Secure configurable SMTP transport, auditable DB outbox and controlled templates.

No provider-specific dependencies. An email is 'sent' only after SMTP confirms acceptance.
"""
import base64, os, re, smtplib, ssl
from datetime import timedelta
from email.message import EmailMessage
from email.utils import formataddr, parseaddr
from string import Template
from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import select
from .db import MailConfig, EmailTemplate, EmailRule, EmailJob, now
from .logic import clean_html, pdf_document

EVENTS={
 'lead_admin': ('New VORA $lead_type inquiry - #$lead_id', '<h2>New $lead_type inquiry</h2><p>Reference: <strong>#$lead_id</strong></p><p>From: $name ($company)</p><p>Email: $email</p><p>Service: $mode</p><p>Origin: $origin &nbsp; Destination: $destination</p><p>Message: $message</p><p>Open in admin: <a href="$admin_url">Lead #$lead_id</a></p>'),
 'lead_customer': ('VORA inquiry received - #$lead_id', '<p>Dear $name,</p><p>Thank you for contacting VORA. Your $lead_type inquiry (#$lead_id) has been received. Our team will review the details and respond by email.</p><p>VORA | Freight & Logistics</p>'),
 'invoice_customer': ('VORA invoice $document_number', '<p>Dear $customer_name,</p><p>Please find attached invoice <strong>$document_number</strong> ($document_date).</p><p>Verify the document using the QR code in the PDF or the link: <a href="$verify_url">Verify invoice</a>.</p><p>VORA | Freight & Logistics</p>'),
 'receipt_customer': ('VORA payment receipt $document_number', '<p>Dear $customer_name,</p><p>Your payment receipt <strong>$document_number</strong> is attached. Verify the document through the QR code or <a href="$verify_url">online verification</a>.</p><p>VORA | Freight & Logistics</p>'),
 'payment_confirmed': ('VORA payment confirmation - $invoice_number', '<p>Dear $customer_name,</p><p>We confirm that your payment of <strong>$payment_amount</strong> has been credited to PT Satu Arah International on $payment_date.</p><p>Invoice: <strong>$invoice_number</strong><br>Payment reference: $payment_reference<br>Invoice status: <strong>$invoice_status</strong><br>Outstanding balance: <strong>$outstanding_amount</strong></p><p>For your records, the official receipt will be delivered separately when any required administrative formalities have been completed.</p><p>VORA | Freight & Logistics</p>'),
 'quotation_approval_request': ('VORA quotation approval requested - $document_number', '<p>Dear $customer_name,</p><p>Please review the attached quotation <strong>$document_number</strong>. You can download, sign and stamp the quotation and securely upload the signed PDF at <a href="$approval_url">the customer approval link</a>.</p><p>Valid until: $valid_until. The approval link will expire on $approval_expiry.</p><p>VORA | Freight & Logistics</p>'),
 'quotation_approved_admin': ('VORA quotation accepted - $document_number', '<p>Quotation $document_number has been reviewed and approved by VORA Finance. A signed/stamped PDF is retained in the private document archive.</p>'),
 'lead_reply': ('Regarding your VORA inquiry #$lead_id', '<p>Dear $name,</p><p>$reply_message</p><p>VORA | Freight & Logistics</p>'),
}


def mail_key():
 key=os.getenv('MAIL_ENCRYPTION_KEY','').strip().encode()
 if not key:raise ValueError('MAIL_ENCRYPTION_KEY must be configured on server before saving SMTP credentials')
 try:return Fernet(key)
 except (ValueError,TypeError) as exc:raise ValueError('MAIL_ENCRYPTION_KEY is not a valid Fernet key') from exc


def email_address(value):
 value=str(value or '').strip()
 display, addr=parseaddr(value)
 if display or addr!=value or len(value)>254 or not re.fullmatch(r'[A-Za-z0-9.!#$%&\'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}',value):
  raise ValueError('Invalid plain email address')
 return value


def bootstrap(db):
 for event,(subject,html) in EVENTS.items():
  if not db.get(EmailTemplate,event):db.add(EmailTemplate(key=event,subject=subject,html=html))
  if not db.get(EmailRule,event):db.add(EmailRule(key=event,enabled=False))
 db.flush()


def save_mail_config(db,data):
 obj=db.get(MailConfig,1)
 if not obj:obj=MailConfig(id=1);db.add(obj)
 host=str(data.get('host','')).strip().lower()
 if host and (not re.fullmatch(r'[a-z0-9.-]{1,253}',host) or '..' in host):raise ValueError('Invalid SMTP hostname')
 port=int(data.get('port') or 587)
 if not 1<=port<=65535:raise ValueError('Invalid SMTP port')
 security=str(data.get('security') or 'starttls')
 if security not in ('starttls','ssl'):raise ValueError('Use STARTTLS or implicit TLS')
 from_email=email_address(data.get('from_email') or 'info@voraworld.id')
 reply_to=email_address(data.get('reply_to') or from_email)
 password=str(data.get('password') or '')
 if password:obj.encrypted_password=mail_key().encrypt(password.encode()).decode()
 obj.host=host;obj.port=port;obj.security=security;obj.username=str(data.get('username') or '')[:240]
 obj.from_email=from_email;obj.from_name=str(data.get('from_name') or 'VORA Freight & Logistics')[:120];obj.reply_to=reply_to
 obj.admin_email=email_address(data.get('admin_email') or 'info@voraworld.id')
 obj.enabled=str(data.get('enabled') or '')=='1'
 if obj.enabled and (not obj.host or not obj.encrypted_password and obj.username):
  raise ValueError('Host and SMTP credentials must be configured before enabling mail')
 db.flush()
 return obj


def render_template(db,event,context):
 template=db.get(EmailTemplate,event)
 if not template:raise ValueError('Missing email template: '+event)
 # Escape all untrusted data before substitution; allow admin-edited limited markup only.
 from markupsafe import escape
 safely={k:str(escape(str(v or ''))) for k,v in context.items()}
 # URLs become safe strings after escaping; protocol validation for admin_url/verify_url is external.
 subject=Template(template.subject).safe_substitute({k:str(v or '') for k,v in context.items()})
 subject=re.sub(r'[\r\n\x00-\x1f\x7f]+',' ',subject)[:250]
 if not subject.strip():raise ValueError('Email template subject is empty')
 html=clean_html(Template(template.html).safe_substitute(safely))
 return subject, html


def enqueue(db,event,recipient,context,attachment_kind='',attachment_id=None,force=False,dedupe_key=None):
 rule=db.get(EmailRule,event)
 if not force and (not rule or not rule.enabled):return None
 conf=db.get(MailConfig,1)
 if not conf or not conf.enabled:return None
 recipient=email_address(recipient)
 subject,html=render_template(db,event,context)
 if dedupe_key:
  prior=db.query(EmailJob).filter_by(dedupe_key=dedupe_key).first()
  if prior:return prior
 job=EmailJob(event=event,recipient=recipient,subject=subject,html=html,attachment_kind=attachment_kind or None,attachment_id=attachment_id,status='queued',attempts=0,dedupe_key=dedupe_key)
 db.add(job);db.flush()
 return job


def send_smtp(conf,recipient,subject,body,attachment=None):
 if not conf.enabled:raise ValueError('SMTP disabled')
 password=mail_key().decrypt(conf.encrypted_password.encode()).decode() if conf.encrypted_password else ''
 msg=EmailMessage()
 msg['From']=formataddr((conf.from_name,conf.from_email))
 msg['To']=email_address(recipient)
 msg['Reply-To']=conf.reply_to
 msg['Subject']=subject
 msg.set_content(re.sub(r'<[^>]+>',' ',body))
 msg.add_alternative(body,subtype='html')
 if attachment:
  filename,pdf=attachment
  msg.add_attachment(pdf,maintype='application',subtype='pdf',filename=filename)
 ctx=ssl.create_default_context()
 if conf.security=='ssl':
  client=smtplib.SMTP_SSL(conf.host,conf.port,timeout=12,context=ctx)
 else:
  client=smtplib.SMTP(conf.host,conf.port,timeout=12)
 try:
  client.ehlo()
  if conf.security=='starttls':client.starttls(context=ctx);client.ehlo()
  if conf.username:client.login(conf.username,password)
  client.send_message(msg)
 finally:client.quit()


def dispatch(db,base_url,limit=10):
 conf=db.get(MailConfig,1)
 if not conf or not conf.enabled:return {'sent':0,'failed':0,'reason':'SMTP disabled'}
 # Lock queued records to prevent concurrent cron workers sending twice.
 statement=select(EmailJob).where(EmailJob.status.in_(['queued','retry']),EmailJob.next_attempt_at<=now()).order_by(EmailJob.id).limit(min(max(limit,1),30))
 if db.bind.dialect.name=='postgresql':statement=statement.with_for_update(skip_locked=True)
 jobs=db.execute(statement).scalars().all()
 result={'sent':0,'failed':0}
 for job in jobs:
  attachment=None
  try:
   if job.attachment_kind:
    from .db import Invoice, Receipt, Payment, Verification, Quotation
    if job.attachment_kind not in ('invoice','receipt','quotation'):raise ValueError('Unsupported email attachment')
    doc=db.get({'invoice':Invoice,'receipt':Receipt,'quotation':Quotation}[job.attachment_kind],job.attachment_id)
    if not doc or doc.status in ('void','draft','pending_stamp','pending_confirmation'):raise ValueError('Attachment is not eligible for sending')
    if job.attachment_kind=='receipt':
     payment=db.get(Payment,doc.payment_id)
     if not payment or payment.status!='recorded':raise ValueError('Receipt payment not confirmed')
     if doc.stamp_required and not doc.stamp_storage_key:raise ValueError('Required e-meterai not uploaded')
    verification=db.query(Verification).filter_by(kind=job.attachment_kind,document_id=job.attachment_id).first()
    if not verification or verification.revoked:raise ValueError('Verification token missing or revoked')
    attachment=(doc.number+'.pdf',pdf_document(db,job.attachment_kind,job.attachment_id,base_url))
   send_smtp(conf,job.recipient,job.subject,job.html,attachment)
  except Exception as exc:
   job.attempts+=1;job.status='failed' if job.attempts>=5 else 'retry'
   job.error=str(exc)[:350];job.next_attempt_at=now()+timedelta(minutes=min(60,2**job.attempts));result['failed']+=1
  else:
   job.attempts+=1;job.status='sent';job.error='';job.sent_at=now();result['sent']+=1
  db.flush();db.commit()
 return result
