-- VORA email and tamper-evident document seals. Apply once after 0002.
BEGIN;
CREATE TABLE IF NOT EXISTS mail_config (id INTEGER PRIMARY KEY,host VARCHAR(253),port INTEGER,security VARCHAR(20),username VARCHAR(240),encrypted_password TEXT,from_email VARCHAR(254),from_name VARCHAR(140),reply_to VARCHAR(254),admin_email VARCHAR(254),enabled BOOLEAN DEFAULT FALSE);
CREATE TABLE IF NOT EXISTS email_templates (key VARCHAR(60) PRIMARY KEY,subject VARCHAR(300) NOT NULL,html TEXT NOT NULL,updated_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS email_rules (key VARCHAR(60) PRIMARY KEY,enabled BOOLEAN DEFAULT FALSE);
CREATE TABLE IF NOT EXISTS email_jobs (id SERIAL PRIMARY KEY,event VARCHAR(60) NOT NULL,recipient VARCHAR(254) NOT NULL,subject VARCHAR(300) NOT NULL,html TEXT NOT NULL,status VARCHAR(20) DEFAULT 'queued',attempts INTEGER DEFAULT 0,next_attempt_at TIMESTAMPTZ DEFAULT NOW(),sent_at TIMESTAMPTZ,error TEXT,attachment_kind VARCHAR(20),attachment_id INTEGER,created_at TIMESTAMPTZ DEFAULT NOW());
CREATE INDEX IF NOT EXISTS ix_email_jobs_queue ON email_jobs (status,next_attempt_at);
CREATE TABLE IF NOT EXISTS document_seals (id SERIAL PRIMARY KEY,kind VARCHAR(20) NOT NULL,document_id INTEGER NOT NULL,fingerprint VARCHAR(64) NOT NULL,signature VARCHAR(64) NOT NULL,snapshot JSONB NOT NULL,key_id VARCHAR(40) DEFAULT 'v1',issued_at TIMESTAMPTZ DEFAULT NOW(),UNIQUE(kind,document_id));
COMMIT;
