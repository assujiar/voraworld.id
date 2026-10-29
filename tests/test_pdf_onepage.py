"""Real PDF pagination regression for VORA financial documents."""
from datetime import date
from io import BytesIO
import pytest
from pypdf import PdfReader
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from vora.db import Base, Setting, Customer, BankAccount, Invoice, InvoiceItem, InvoiceBankInstruction, Quotation, QuotationItem
from vora.logic import calc_lines, pdf_document, ensure_public_code, next_number, create_verification
from vora.pdf_compact import DocumentTooLong


def test_invoice_five_items_per_page_quotation_ten_on_one_page():
    engine=create_engine('sqlite:///:memory:')
    Base.metadata.create_all(engine)
    S=sessionmaker(engine,expire_on_commit=False)
    with S() as db:
        for key,value in {
            'legal_name':'PT Satu Arah International',
            'email':'info@voraworld.id',
            'address':'Gedung Nucira, Jl. Letjen M.T. Haryono Kav. 27, Tebet, Jakarta Selatan, DKI Jakarta 12810'
        }.items():db.add(Setting(key=key,value=value))
        customer=Customer(name='SAMPLE CLIENT INDUSTRIAL LOGISTICS PT',email='finance@example.invalid',
                          address='Jl. Contoh Sentra Industri Blok A, Jakarta, Indonesia',currency='IDR')
        db.add(customer);db.flush()
        code=ensure_public_code(db,customer)
        source=[{'description':f'{i:02d} International freight and customs handling / cargo services from Jakarta to destination {i}',
                 'unit':'shipment','quantity':'1','price':str(725000+i*50000)} for i in range(1,11)]
        amounts=calc_lines(source,'IDR','11','2')
        invoice=Invoice(number=next_number(db,'INV',code,'2026-10-29'),customer_id=customer.id,
                        issued_at='2026-10-29',due_at='2026-11-12',status='issued',currency='IDR',
                        po_number='VORA-PO-001',shipment_reference='JOB-EXPORT-0009',
                        discount_minor=0,notes='Rates exclude additional services unless specifically listed. Pay the invoiced amount to one of the listed company bank accounts.',
                        tax_percent='11',withholding_percent='2',
                        **{k:amounts[k] for k in ('subtotal_minor','tax_minor','withholding_minor','total_minor')},
                        outstanding_minor=amounts['total_minor'])
        db.add(invoice);db.flush()
        for item in amounts['items']:db.add(InvoiceItem(invoice_id=invoice.id,**item))
        for i in range(3):
            bank=BankAccount(bank_name=f'SAMPLE BANK {i+1}',account_holder='PT Satu Arah International',
                             account_number=f'990000000{i+1}',currency='IDR',active=True)
            db.add(bank);db.flush()
            db.add(InvoiceBankInstruction(invoice_id=invoice.id,bank_account_id=bank.id,
                                         position=i,bank_name=bank.bank_name,account_number=bank.account_number,
                                         account_holder=bank.account_holder,currency='IDR'))
        create_verification(db,'invoice',invoice.id)
        quote=Quotation(number=next_number(db,'QUO',code,'2026-10-29'),customer_id=customer.id,
                        issued_at='2026-10-29',valid_until='2026-11-10',status='issued',currency='IDR',
                        subtotal_minor=amounts['subtotal_minor'],tax_minor=amounts['tax_minor'],
                        total_minor=amounts['subtotal_minor']+amounts['tax_minor'],
                        notes='Customer approval requires authorized signature and company stamp.')
        db.add(quote);db.flush()
        for item in amounts['items']:db.add(QuotationItem(quotation_id=quote.id,**item))
        create_verification(db,'quotation',quote.id)
        db.commit()
        for kind,doc in [('invoice',invoice),('quotation',quote)]:
            pdf=pdf_document(db,kind,doc.id,'https://staging.example.invalid')
            import os
            from pathlib import Path
            if os.getenv('VORA_PDF_QA_OUTPUT'):
                out=Path(os.environ['VORA_PDF_QA_OUTPUT']);out.mkdir(parents=True,exist_ok=True)
                (out/f'VORA_{kind.capitalize()}_10_Items_One_Page.pdf').write_bytes(pdf)
            reader=PdfReader(BytesIO(pdf))
            if kind=='invoice':
                assert 2 <= len(reader.pages) <= 3, '10 line items must be split into five-per-page blocks (with optional summary page)'
                for page in reader.pages:
                    page_text=page.extract_text() or ''
                    # Each item description has the distinctive `International freight` marker.
                    assert page_text.count('International freight') <= 5
            else:
                assert len(reader.pages)==1, 'Quotation with up to ten items should fit one page'
            text='\n'.join(page.extract_text() or '' for page in reader.pages)
            for item in source:
                assert ' '.join(item['description'].split()) in ' '.join(text.split()), f'missing item: {item}'
            assert doc.number in text
            assert ('01 OF' in text if kind=='invoice' else '1 OF 1' in text)
            if kind=='invoice':
                assert all(f'990000000{i+1}' in text for i in range(3))
                assert 'OUTSTANDING' in text
            else:
                assert 'APPROVED BY CUSTOMER' in text
                assert 'COMPANY STAMP' in text


def test_oversized_document_fails_instead_of_clipping_or_faking_single_page():
    engine=create_engine('sqlite:///:memory:')
    Base.metadata.create_all(engine)
    S=sessionmaker(engine,expire_on_commit=False)
    with S() as db:
        customer=Customer(name='SAMPLE CUSTOMER',currency='IDR')
        db.add(customer);db.flush();code=ensure_public_code(db,customer)
        amount=calc_lines([{'description':'Extremely long details '*28,'unit':'job','quantity':'1','price':'100000'} for _ in range(10)],'IDR')
        q=Quotation(number=next_number(db,'QUO',code,'2026-10-29'),customer_id=customer.id,
                    issued_at='2026-10-29',valid_until='2026-11-10',status='issued',currency='IDR',
                    subtotal_minor=amount['subtotal_minor'],total_minor=amount['total_minor'],
                    notes='Very long terms '*110)
        db.add(q);db.flush()
        for item in amount['items']:db.add(QuotationItem(quotation_id=q.id,**item))
        create_verification(db,'quotation',q.id)
        db.commit()
        with pytest.raises(DocumentTooLong):pdf_document(db,'quotation',q.id,'https://staging.example.invalid')
