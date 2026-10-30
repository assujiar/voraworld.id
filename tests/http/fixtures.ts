import { randomBytes } from 'node:crypto'
import { sha256Hex } from '@/server/crypto'

/**
 * Business records for the real-server tests. They are created with the same services the admin screens use, against the
 * database the running server reads. Idempotent: the second test file reuses what the first one created.
 */
export interface Seed {
  ids: { customers: number; quotations: number; invoices: number; receipts: number; 'bank-accounts': number; 'quotation-approvals': number; draftInvoice: number; voidInvoice: number; stampReceipt: number }
  tokens: { invoice: string; draftInvoice: string; voidInvoice: string; receipt: string; stampReceipt: string; quotation: string; approval: string }
}

export async function seedFinance(): Promise<Seed> {
  process.env.DATABASE_URL = process.env.HTTP_DATABASE_URL
  process.env.SUPABASE_URL = process.env.HTTP_SUPABASE_URL                       // the stand-in storage service the server also uses
  process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.HTTP_SUPABASE_KEY
  const { sql } = await import('@/server/db')
  const { createBank } = await import('@/server/finance/banks')
  const { saveCustomer } = await import('@/server/finance/customers')
  const { createInvoice, setInvoiceStatus } = await import('@/server/finance/invoices')
  const { confirmPayment, recordPayment } = await import('@/server/finance/payments')
  const { createQuotation, setQuotationStatus, submitApproval } = await import('@/server/finance/quotations')
  const { makePdf } = await import('../helpers/pdf')

  const [existing] = await sql`select id from customers where name = 'HTTP Fixture Customer'`
  const token = async (kind: 'invoice' | 'receipt' | 'quotation', id: number) => (await sql`select token from document_verification_tokens where kind = ${kind} and document_id = ${id}`)[0].token as string
  const BASE = process.env.HTTP_BASE_URL!
  if (!existing) {
    const [admin] = await sql`select id from users where role = 'admin' order by id limit 1`
    const actor = admin.id as number
    const customer = await saveCustomer(actor, null, { name: 'HTTP Fixture Customer', email: 'billing@fixture.example', address: 'Jl. Fixture 1', taxId: '', currency: 'IDR', termsDays: '14' })
    const usd = await saveCustomer(actor, null, { name: 'HTTP Fixture USD', email: 'usd@fixture.example', address: '', taxId: '', currency: 'USD', termsDays: '14' })
    const bank = await createBank(actor, { bankName: 'Fixture Bank', accountNumber: '9900001111', accountHolder: 'PT Satu Arah International', currency: 'IDR', branch: '', swiftCode: '', notes: '' })
    const usdBank = await createBank(actor, { bankName: 'Fixture USD Bank', accountNumber: '9900002222', accountHolder: 'PT Satu Arah International', currency: 'USD', branch: '', swiftCode: '', notes: '' })
    const invoice = (customerId: number, bankIds: number[], price = '1000000') => createInvoice(actor, {
      customerId, issuedAt: '2026-10-05', dueAt: '2026-10-19', taxPercent: '0', withholdingPercent: '0', discount: '0', poNumber: '', shipmentReference: '', serviceMode: '', origin: '', destination: '',
      transportDocumentRef: '', notes: '', items: `Fixture freight | 1 | ${price} | job`, bankAccountIds: bankIds,
    })
    const issued = await invoice(customer, [bank]); await setInvoiceStatus(actor, issued, 'issue')
    const pay = await recordPayment(actor, issued, { amount: '400000', date: '', method: 'cash', reference: 'F-1', receivingBankId: null })
    const { receiptId } = await confirmPayment(actor, pay, { fundsCleared: true, receivingBankId: null }, BASE)
    await invoice(customer, [bank])                                                 // stays a draft
    const voided = await invoice(customer, [bank]); await setInvoiceStatus(actor, voided, 'void')
    const usdInvoice = await invoice(usd, [usdBank], '100'); await setInvoiceStatus(actor, usdInvoice, 'issue')
    const usdPay = await recordPayment(actor, usdInvoice, { amount: '50', date: '', method: 'wire', reference: 'U-1', receivingBankId: usdBank })
    await confirmPayment(actor, usdPay, { fundsCleared: true, receivingBankId: null }, BASE)   // a foreign-currency receipt: waits for its e-meterai

    const quotation = await createQuotation(actor, { recipient: `customer:${customer}`, issuedAt: '2026-10-05', validUntil: '2999-01-01', taxPercent: '0', paymentTerms: 'Payment within 14 days of the invoice date', termsConditions: 'Rates are valid for the period stated. Services follow the booking conditions of VORA.', notes: '', items: 'Fixture quote | 1 | 500000 | job' })
    await setQuotationStatus(actor, quotation, 'issue')
    await sql`update quotations set status = 'awaiting_approval' where id = ${quotation}`
    const approvalToken = randomBytes(42).toString('base64url')
    await sql`insert into quotation_approvals (quotation_id, token_hash, expires_at, status) values (${quotation}, ${await sha256Hex(approvalToken)}, now() + interval '7 days', 'pending')`
    // A submitted file (stored privately) so the admin download route has something to serve.
    const [quo] = await sql`select number from quotations where id = ${quotation}`
    await submitApproval({ token: approvalToken, signerName: 'Fixture Signer', signerTitle: 'Director', acknowledged: true, file: await makePdf([quo.number as string, 'signed']) })
    await sql`insert into settings (key, value) values ('fixture_approval_token', ${approvalToken}) on conflict (key) do update set value = excluded.value`
  }
  const one = async (query: Promise<Array<Record<string, unknown>>>) => (await query)[0].id as number
  const customers = await one(sql`select id from customers where name = 'HTTP Fixture Customer'`)
  const invoices = await one(sql`select id from invoices where status = 'partially_paid' order by id limit 1`)
  const draftInvoice = await one(sql`select id from invoices where status = 'draft' order by id limit 1`)
  const voidInvoice = await one(sql`select id from invoices where status = 'void' order by id limit 1`)
  const receipts = await one(sql`select id from receipts where status = 'issued' order by id limit 1`)
  const stampReceipt = await one(sql`select id from receipts where status = 'pending_stamp' order by id limit 1`)
  const quotations = await one(sql`select id from quotations order by id limit 1`)
  const [approval] = await sql`select id from quotation_approvals order by id limit 1`
  const [bankRow] = await sql`select id from bank_accounts order by id limit 1`
  const [approvalToken] = await sql`select value from settings where key = 'fixture_approval_token'`
  return {
    ids: { customers, quotations, invoices, receipts, 'bank-accounts': bankRow.id as number, 'quotation-approvals': approval.id as number, draftInvoice, voidInvoice, stampReceipt },
    tokens: {
      invoice: await token('invoice', invoices), draftInvoice: await token('invoice', draftInvoice), voidInvoice: await token('invoice', voidInvoice), receipt: await token('receipt', receipts),
      stampReceipt: await token('receipt', stampReceipt), quotation: await token('quotation', quotations), approval: approvalToken.value as string,
    },
  }
}
