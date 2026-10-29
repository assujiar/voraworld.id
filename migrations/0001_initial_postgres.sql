-- VORA initial PostgreSQL/Supabase schema
-- Apply on a NEW database via Supabase SQL editor or psql.
-- Do not reapply on existing data. No demo users/data are created.
BEGIN;

CREATE TABLE articles (
	id SERIAL NOT NULL, 
	slug VARCHAR(200), 
	title VARCHAR(240), 
	excerpt TEXT, 
	body TEXT, 
	category VARCHAR(80), 
	tags VARCHAR(400), 
	locale VARCHAR(8), 
	status VARCHAR(20), 
	cover VARCHAR(500), 
	author VARCHAR(120), 
	seo_title VARCHAR(200), 
	seo_description VARCHAR(300), 
	created_at TIMESTAMP WITH TIME ZONE, 
	published_at TIMESTAMP WITH TIME ZONE, 
	updated_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	UNIQUE (slug)
)

;


CREATE TABLE audit_logs (
	id SERIAL NOT NULL, 
	actor_id INTEGER, 
	verb VARCHAR(90), 
	object_type VARCHAR(50), 
	object_id INTEGER, 
	summary TEXT, 
	created_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id)
)

;


CREATE TABLE counters (
	id SERIAL NOT NULL, 
	kind VARCHAR(20) NOT NULL, 
	period VARCHAR(6) NOT NULL, 
	next_value INTEGER, 
	PRIMARY KEY (id), 
	UNIQUE (kind, period)
)

;


CREATE TABLE coverage (
	id SERIAL NOT NULL, 
	region VARCHAR(160) NOT NULL, 
	mode VARCHAR(100), 
	active BOOLEAN, 
	verified_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id)
)

;


CREATE TABLE customers (
	id SERIAL NOT NULL, 
	name VARCHAR(200) NOT NULL, 
	email VARCHAR(200), 
	phone VARCHAR(100), 
	address TEXT, 
	tax_id VARCHAR(100), 
	currency VARCHAR(8), 
	terms_days INTEGER, 
	created_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id)
)

;


CREATE TABLE document_verification_tokens (
	id SERIAL NOT NULL, 
	token_hash VARCHAR(64) NOT NULL, 
	token VARCHAR(120) NOT NULL, 
	kind VARCHAR(20) NOT NULL, 
	document_id INTEGER NOT NULL, 
	revoked BOOLEAN, 
	created_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	UNIQUE (token_hash), 
	UNIQUE (token)
)

;


CREATE TABLE faqs (
	id SERIAL NOT NULL, 
	question VARCHAR(400) NOT NULL, 
	answer TEXT NOT NULL, 
	service VARCHAR(100), 
	position INTEGER, 
	visible BOOLEAN, 
	PRIMARY KEY (id)
)

;


CREATE TABLE leads (
	id SERIAL NOT NULL, 
	type VARCHAR(20), 
	name VARCHAR(140) NOT NULL, 
	company VARCHAR(200), 
	email VARCHAR(200) NOT NULL, 
	phone VARCHAR(100), 
	message TEXT, 
	mode VARCHAR(80), 
	origin VARCHAR(160), 
	destination VARCHAR(160), 
	cargo TEXT, 
	pickup VARCHAR(60), 
	status VARCHAR(30), 
	priority VARCHAR(20), 
	assignee VARCHAR(160), 
	followup VARCHAR(30), 
	source VARCHAR(100), 
	created_at TIMESTAMP WITH TIME ZONE, 
	updated_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id)
)

;


CREATE TABLE media (
	id SERIAL NOT NULL, 
	filename VARCHAR(250) NOT NULL, 
	storage_key VARCHAR(500) NOT NULL, 
	url VARCHAR(800) NOT NULL, 
	alt VARCHAR(400), 
	category VARCHAR(90), 
	mime VARCHAR(90), 
	size INTEGER, 
	created_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id)
)

;


CREATE TABLE navigation_items (
	id SERIAL NOT NULL, 
	label VARCHAR(100) NOT NULL, 
	href VARCHAR(250) NOT NULL, 
	position INTEGER, 
	location VARCHAR(20), 
	visible BOOLEAN, 
	PRIMARY KEY (id)
)

;


CREATE TABLE pages (
	id SERIAL NOT NULL, 
	slug VARCHAR(160) NOT NULL, 
	title VARCHAR(200) NOT NULL, 
	description TEXT, 
	locale VARCHAR(8), 
	status VARCHAR(20), 
	seo_title VARCHAR(200), 
	seo_description TEXT, 
	updated_at TIMESTAMP WITH TIME ZONE, 
	published_snapshot JSON, 
	PRIMARY KEY (id), 
	UNIQUE (slug)
)

;


CREATE TABLE revisions (
	id SERIAL NOT NULL, 
	resource VARCHAR(30), 
	resource_id INTEGER, 
	snapshot JSON, 
	author_id INTEGER, 
	created_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id)
)

;


CREATE TABLE seo_redirects (
	id SERIAL NOT NULL, 
	old_path VARCHAR(350), 
	new_path VARCHAR(350), 
	status INTEGER, 
	PRIMARY KEY (id), 
	UNIQUE (old_path)
)

;


CREATE TABLE settings (
	key VARCHAR(120) NOT NULL, 
	value TEXT NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (key)
)

;


CREATE TABLE users (
	id SERIAL NOT NULL, 
	email VARCHAR(200) NOT NULL, 
	password_hash VARCHAR(300) NOT NULL, 
	role VARCHAR(30) NOT NULL, 
	active BOOLEAN, 
	created_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	UNIQUE (email)
)

;


CREATE TABLE invoices (
	id SERIAL NOT NULL, 
	number VARCHAR(70) NOT NULL, 
	customer_id INTEGER NOT NULL, 
	status VARCHAR(30), 
	currency VARCHAR(8), 
	issued_at VARCHAR(10), 
	due_at VARCHAR(10), 
	notes TEXT, 
	tax_percent VARCHAR(20), 
	withholding_percent VARCHAR(20), 
	discount_minor INTEGER, 
	subtotal_minor INTEGER, 
	tax_minor INTEGER, 
	withholding_minor INTEGER, 
	total_minor INTEGER, 
	outstanding_minor INTEGER, 
	created_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	UNIQUE (number), 
	FOREIGN KEY(customer_id) REFERENCES customers (id)
)

;


CREATE TABLE lead_activities (
	id SERIAL NOT NULL, 
	lead_id INTEGER, 
	actor_id INTEGER, 
	message TEXT NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(lead_id) REFERENCES leads (id) ON DELETE CASCADE
)

;


CREATE TABLE sections (
	id SERIAL NOT NULL, 
	page_id INTEGER, 
	position INTEGER, 
	kind VARCHAR(30), 
	layout VARCHAR(30), 
	visible BOOLEAN, 
	title VARCHAR(200), 
	body TEXT, 
	image VARCHAR(500), 
	button_label VARCHAR(120), 
	button_href VARCHAR(400), 
	surface VARCHAR(20), 
	PRIMARY KEY (id), 
	FOREIGN KEY(page_id) REFERENCES pages (id) ON DELETE CASCADE
)

;


CREATE TABLE invoice_items (
	id SERIAL NOT NULL, 
	invoice_id INTEGER, 
	description VARCHAR(500) NOT NULL, 
	unit VARCHAR(30), 
	quantity VARCHAR(30) NOT NULL, 
	price_minor INTEGER NOT NULL, 
	amount_minor INTEGER NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(invoice_id) REFERENCES invoices (id) ON DELETE CASCADE
)

;


CREATE TABLE payments (
	id SERIAL NOT NULL, 
	invoice_id INTEGER NOT NULL, 
	amount_minor INTEGER NOT NULL, 
	date VARCHAR(10), 
	method VARCHAR(100), 
	reference VARCHAR(160), 
	notes TEXT, 
	status VARCHAR(20), 
	created_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(invoice_id) REFERENCES invoices (id)
)

;


CREATE TABLE receipts (
	id SERIAL NOT NULL, 
	number VARCHAR(70) NOT NULL, 
	invoice_id INTEGER NOT NULL, 
	payment_id INTEGER NOT NULL, 
	status VARCHAR(20), 
	created_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	UNIQUE (number), 
	FOREIGN KEY(invoice_id) REFERENCES invoices (id), 
	UNIQUE (payment_id), 
	FOREIGN KEY(payment_id) REFERENCES payments (id)
)

;

CREATE INDEX ix_articles_status_published ON articles (status, published_at);
CREATE INDEX ix_lead_status_date ON leads (status, created_at);
CREATE INDEX ix_invoice_status ON invoices (status);
COMMIT;
