"""Document detail and sensitive-data checks for realistic VORA commercial records."""
from io import BytesIO
from pathlib import Path
from datetime import datetime, timezone
from pypdf import PdfReader
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker



def test_invoice_and_receipt_contain_real_metadata_and_ledger_reconciliation():
    from vora.db import Base, Setting, User, Customer, Invoice, InvoiceItem, Payment, Receipt, BankAccount, InvoiceBankInstruction
    from vora.logic import create_verification, ensure_public_code, next_number, pdf_document, calc_lines
    dbengine=create_engine('sqlite:///:memory:')
    Base.metadata.create_all(dbengine)
    S=sessionmaker(dbengine,expire_on_commit=False)
    with S() as db:
        db.add_all([Setting(key='legal_name',value='PT Satu Arah International'),
                    Setting(key='address',value='Gedung Nucira, Jakarta Selatan'),
                    Setting(key='email',value='info@voraworld.id')])
        user=User(email='finance-qa@example.invalid',role='finance',password_hash='not-valid-login-hash')
        customer=Customer(name='FICTITIOUS CUSTOMER FOR QA',email='qa@example.invalid',
                          address='Bogor Industrial Estate, Indonesia',tax_id='QA-TAX-ONLY',currency='IDR')
        db.add_all([customer,user]);db.flush();code=ensure_public_code(db,customer)
        lines=[dict(description=f'Freight service line {i}',quantity='1',price='2500000',unit='shipment') for i in range(1,6)]
        a=calc_lines(lines,'IDR',tax='11',withholding='2')
        inv=Invoice(number=next_number(db,'INV',code,'2026-10-29'),customer_id=customer.id,
                    status='partially_paid',issued_at='2026-10-29',due_at='2026-11-28',currency='IDR',
                    po_number='QA-PO-1122',shipment_reference='QA-JOB-3322',
                    service_mode='SEA IMPORT FCL + CUSTOMS BROKERAGE',
                    origin='Shanghai (CNSHA)',destination='Tanjung Priok (IDJKT) - Cikarang',
                    transport_document_ref='BL-QA-554488',tax_percent='11',withholding_percent='2',
                    subtotal_minor=a['subtotal_minor'],tax_minor=a['tax_minor'],
                    withholding_minor=a['withholding_minor'],total_minor=a['total_minor'],
                    outstanding_minor=a['total_minor']-2_000_000,notes='Freight service subject to approved booking conditions.')
        db.add(inv);db.flush()
        for item in a['items']:db.add(InvoiceItem(invoice_id=inv.id,**item))
        bank=BankAccount(bank_name='QA BANK',account_number='00123344',account_holder='PT Satu Arah International',currency='IDR')
        db.add(bank);db.flush()
        db.add(InvoiceBankInstruction(invoice_id=inv.id,bank_account_id=bank.id,bank_name=bank.bank_name,
                                      account_number=bank.account_number,account_holder=bank.account_holder,
                                      currency='IDR',position=0))
        p=Payment(invoice_id=inv.id,status='recorded',amount_minor=2_000_000,date='2026-10-29',
                  method='Corporate Bank Transfer',reference='QA-TRANSACTION-121212',
                  confirmed_by=user.id,confirmed_at=datetime(2026,10,29,8,0,tzinfo=timezone.utc),
                  receiving_bank_snapshot={'bank_name':'QA BANK','account_number':'00123344','account_holder':'PT Satu Arah International'})
        db.add(p);db.flush()
        rec=Receipt(invoice_id=inv.id,payment_id=p.id,status='issued',stamp_required=False,
                    number=next_number(db,'RCP',code,'2026-10-29'))
        db.add(rec);db.flush()
        create_verification(db,'invoice',inv.id);create_verification(db,'receipt',rec.id)
        db.commit()
        invoice_pdf=pdf_document(db,'invoice',inv.id,'https://staging.example.invalid')
        invoice_pages=PdfReader(BytesIO(invoice_pdf)).pages
        assert len(invoice_pages)==1, 'Five items and one bank must fit on one A4 invoice'
        it=invoice_pages[0].extract_text()
        for segment in ('COMMERCIAL INVOICE','QA-PO-1122','QA-JOB-3322',
                        'SEA IMPORT FCL','Shanghai (CNSHA)','Tanjung Priok',
                        'BL-QA-554488','NET 30 DAYS','TAX (11%)','WITHHOLDING (2%)',
                        'QA-TAX-ONLY','00123344','OUTSTANDING'):
            assert segment in it,segment
        receipt_pdf=pdf_document(db,'receipt',rec.id,'https://staging.example.invalid')
        import os
        if os.environ.get('VORA_DETAILED_PDF_EXPORT'):
            folder=Path(os.environ['VORA_DETAILED_PDF_EXPORT'])
            folder.mkdir(parents=True,exist_ok=True)
            (folder/'VORA_Detailed_Invoice_QA.pdf').write_bytes(invoice_pdf)
            (folder/'VORA_Detailed_Receipt_QA.pdf').write_bytes(receipt_pdf)
        receipt_pages=PdfReader(BytesIO(receipt_pdf)).pages
        assert len(receipt_pages)==1
        rt=receipt_pages[0].extract_text()
        for segment in ('OFFICIAL PAYMENT RECEIPT','PAYMENT ALLOCATION','PAYMENT METHOD',
                        'QA-TRANSACTION-121212','Two Million Indonesian Rupiah',
                        'PARTIALLY PAID','finance-qa@example.invalid','BALANCE DUE','00123344'):
            assert segment in rt,segment
        assert 'Digital verification is not' not in it+rt
        assert 'WHATSAPP' not in it+rt.upper()


def test_english_idr_words_are_exact_for_sample_values():
    from vora.pdf_receipt import _english_words
    assert _english_words(0)=='Zero'
    assert _english_words(25000000)=='Twenty-Five Million'
    assert _english_words(120050000)=='One Hundred Twenty Million Fifty Thousand'
