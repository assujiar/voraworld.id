/** What the PDF layouts need, already loaded and plain: the renderers never touch the database. */
/** The company that issues the document. `taxId` is its NPWP (empty when none is set). */
export interface Issuer { legalName: string; address: string; email: string; taxId: string }
export interface Party { name: string; address: string; email: string; taxId: string }
export interface LineData { description: string; unit: string; quantity: string; priceMinor: number; amountMinor: number }
export interface BankLine { bankName: string; accountNumber: string; accountHolder: string; currency: string; swiftCode: string; position: number }

export interface InvoiceData {
  number: string; status: string; currency: string; issuedAt: string; dueAt: string
  poNumber: string; shipmentReference: string; serviceMode: string; origin: string; destination: string; transportDocumentRef: string; notes: string
  taxPercent: string; withholdingPercent: string; discountMinor: number; subtotalMinor: number; taxMinor: number; withholdingMinor: number; totalMinor: number; outstandingMinor: number
  items: LineData[]; banks: BankLine[]; customer: Party
}

export interface QuotationData {
  number: string; status: string; currency: string; issuedAt: string; validUntil: string
  /** What the customer pays and when; the terms the customer's signature accepts; anything else. Empty on quotations that predate them. */
  paymentTerms: string; termsConditions: string; notes: string
  taxPercent: string; subtotalMinor: number; taxMinor: number; totalMinor: number
  items: LineData[]; recipient: Party
  /** The customer's private upload link while an approval request is open: printed as a clickable address. */
  uploadUrl?: string
}

export interface ReceiptData {
  number: string; status: string; issuedOn: string; stampRequired: boolean
  payment: { id: number; amountMinor: number; date: string; method: string; reference: string; confirmedAt: Date | null; confirmedBy: string; bank: Record<string, string> | null }
  invoice: { number: string; currency: string; totalMinor: number; outstandingMinor: number }
  payer: Party
}

/** The pre-payment receipt: issued with the invoice, BEFORE the money arrives. `issuedOn` is the invoice's issue date. */
export interface PrepaymentData {
  number: string; status: string; stampRequired: boolean; issuedOn: string
  currency: string; amountMinor: number
  invoice: { number: string; issuedAt: string; dueAt: string; poNumber: string; shipmentReference: string }
  payer: Party; banks: BankLine[]
}

/** A general document (letter, statement, certificate...): what was typed, plus the invoices and bank accounts a billing letter lists. */
export interface GeneralDocData {
  number: string; kind: string; language: 'id' | 'en'; status: string; documentDate: string
  values: Record<string, string>
  invoices: Array<{ number: string; issuedAt: string; dueAt: string; currency: string; totalMinor: number; outstandingMinor: number }>
  banks: BankLine[]
}
