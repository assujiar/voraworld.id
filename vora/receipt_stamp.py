"""Manually-applied, externally-issued e-meterai PDF storage.

This code NEVER manufactures, overlays or validates a government-issued e-meterai.
It saves the final PDF issued by an approved provider. Private and immutable.
"""
import hashlib
import io
import os
import re
import secrets
import urllib.request
from pathlib import Path
from pypdf import PdfReader

# Vercel rejects request bodies above 4.5 MB before they reach the app, so a hosted deployment must
# advertise a lower limit than the 10 MB default. MAX_UPLOAD_BYTES overrides both.
MAX_STAMPED_PDF=int(os.getenv('MAX_UPLOAD_BYTES') or (4_000_000 if os.getenv('VERCEL') else 10*1024*1024))
STAMP_LIMIT_IDR=5_000_000


def requires_stamp(currency:str, amount_minor:int)->bool:
    # Non-IDR requires manual stamp review: no FX calculation without verified rate.
    return currency!='IDR' or int(amount_minor)>STAMP_LIMIT_IDR


def inspect_uploaded_pdf(binary:bytes, receipt_number:str, invoice_number:str)->str:
    if not binary.startswith(b'%PDF-') or len(binary)>MAX_STAMPED_PDF or len(binary)<300:
        raise ValueError('Only PDF documents up to 10 MB are accepted')
    try:
        reader=PdfReader(io.BytesIO(binary),strict=True)
        if reader.is_encrypted or not 1<=len(reader.pages)<=12:
            raise ValueError('PDF must be readable, unencrypted and 1-12 pages')
        # Keep the original VORA reference and QR link text in the stamped export.
        text='\n'.join((page.extract_text() or '') for page in reader.pages)
        if receipt_number not in text or invoice_number not in text:
            raise ValueError('Stamped PDF must retain VORA receipt and related invoice numbers')
        # Protect from interactive actions in final financial documents.
        catalog=reader.trailer['/Root']
        if '/OpenAction' in catalog or '/AA' in catalog or '/Names' in catalog and '/JavaScript' in catalog['/Names']:
            raise ValueError('Active or executable PDF content is forbidden')
    except ValueError:
        raise
    except Exception as exc:
        raise ValueError('Invalid or damaged PDF') from exc
    return hashlib.sha256(binary).hexdigest()


def _storage():
    domain=os.getenv('SUPABASE_URL','').rstrip('/')
    secret=os.getenv('SUPABASE_SERVICE_ROLE_KEY','')
    if os.getenv('APP_ENV','development')=='production':
        if not domain.startswith('https://') or not secret:
            raise RuntimeError('Private PDF storage is not configured')
        return 'remote',domain,secret
    return 'local',None,None


def save_stamped_pdf(receipt_id:int, binary:bytes)->str:
    key=f'receipt-stamps/{receipt_id}/{secrets.token_urlsafe(22)}.pdf'
    mode,domain,secret=_storage()
    if mode=='remote':
        bucket=os.getenv('SUPABASE_DOCUMENTS_BUCKET','vora-documents')
        url=f'{domain}/storage/v1/object/{bucket}/{key}'
        request=urllib.request.Request(url,data=binary,method='POST',headers={
            'apikey':secret,'Authorization':'Bearer '+secret,'Content-Type':'application/pdf','x-upsert':'false'
        })
        with urllib.request.urlopen(request,timeout=30) as response: response.read()
    else:
        path=Path(__file__).resolve().parent.parent/'protected'/key
        path.parent.mkdir(parents=True,exist_ok=True)
        with path.open('xb') as output:output.write(binary)
    return key


def load_stamped_pdf(key:str)->bytes:
    if not re.fullmatch(r'receipt-stamps/[0-9]+/[a-zA-Z0-9_-]+\.pdf',key or ''):
        raise ValueError('Invalid PDF storage reference')
    mode,domain,secret=_storage()
    if mode=='remote':
        bucket=os.getenv('SUPABASE_DOCUMENTS_BUCKET','vora-documents')
        url=f'{domain}/storage/v1/object/{bucket}/{key}'
        request=urllib.request.Request(url,headers={'apikey':secret,'Authorization':'Bearer '+secret})
        with urllib.request.urlopen(request,timeout=30) as response:return response.read(MAX_STAMPED_PDF+1)
    return (Path(__file__).resolve().parent.parent/'protected'/key).read_bytes()


def final_receipt_pdf(receipt)->bytes:
    if receipt.status!='issued' or not receipt.stamp_storage_key or not receipt.stamp_sha256:
        raise ValueError('Stamped receipt not yet released')
    binary=load_stamped_pdf(receipt.stamp_storage_key)
    if hashlib.sha256(binary).hexdigest()!=receipt.stamp_sha256:
        raise ValueError('Stored stamped PDF integrity check failed')
    return binary


# Private storage for manually signed / stamped quotation acceptances.
def save_quotation_approval_pdf(approval_id:int, binary:bytes)->str:
    key=f'quotation-approvals/{approval_id}/{secrets.token_urlsafe(22)}.pdf'
    mode,domain,secret=_storage()
    if mode=='remote':
        bucket=os.getenv('SUPABASE_DOCUMENTS_BUCKET','vora-documents')
        url=f'{domain}/storage/v1/object/{bucket}/{key}'
        request=urllib.request.Request(url,data=binary,method='POST',headers={
            'apikey':secret,'Authorization':'Bearer '+secret,'Content-Type':'application/pdf','x-upsert':'false'
        })
        with urllib.request.urlopen(request,timeout=30) as response: response.read()
    else:
        path=Path(__file__).resolve().parent.parent/'protected'/key
        path.parent.mkdir(parents=True,exist_ok=True)
        with path.open('xb') as out:out.write(binary)
    return key


def load_quotation_approval_pdf(key:str)->bytes:
    if not re.fullmatch(r'quotation-approvals/[0-9]+/[a-zA-Z0-9_-]+\.pdf',key or ''):
        raise ValueError('Invalid protected approval key')
    mode,domain,secret=_storage()
    if mode=='remote':
        bucket=os.getenv('SUPABASE_DOCUMENTS_BUCKET','vora-documents')
        url=f'{domain}/storage/v1/object/{bucket}/{key}'
        request=urllib.request.Request(url,headers={'apikey':secret,'Authorization':'Bearer '+secret})
        with urllib.request.urlopen(request,timeout=30) as response:return response.read(MAX_STAMPED_PDF+1)
    return (Path(__file__).resolve().parent.parent/'protected'/key).read_bytes()


def inspect_signed_quotation(binary:bytes,quotation_number:str)->str:
    if not binary.startswith(b'%PDF-') or len(binary)>MAX_STAMPED_PDF or len(binary)<300:
        raise ValueError('Upload a PDF not exceeding 10 MB')
    try:
        reader=PdfReader(io.BytesIO(binary),strict=True)
        if reader.is_encrypted or not 1<=len(reader.pages)<=15:
            raise ValueError('PDF must be readable and unencrypted')
        content='\n'.join(page.extract_text() or '' for page in reader.pages)
        if quotation_number not in content:
            raise ValueError('The signed file must include the exact VORA quotation number')
        root=reader.trailer['/Root']
        if '/OpenAction' in root or '/AA' in root:
            raise ValueError('Interactive PDF actions are not permitted')
        if '/Names' in root and '/JavaScript' in root['/Names']:
            raise ValueError('PDF JavaScript is not permitted')
    except ValueError:raise
    except Exception as exc:raise ValueError('Unreadable or damaged PDF') from exc
    return hashlib.sha256(binary).hexdigest()
