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
  /** The validated quotation this invoice comes from and the delivery notes it bills (empty for an invoice made before they were linked). */
  quotationNumber?: string; deliveryNumbers?: string[]
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

/** A delivery note (surat jalan). `captureUrl` is the address in its QR code: where the receiver signs. */
export interface DeliveryNoteData {
  number: string; status: string; deliveryDate: string
  consigneeName: string; consigneeAddress: string; consigneeContact: string; consigneePhone: string; consigneeEmail: string
  origin: string; destination: string; shipmentReference: string; poNumber: string; carrier: string; vehicle: string; vehiclePlate: string; driverName: string; driverPhone: string
  notes: string
  items: Array<{ description: string; quantity: string; unit: string; remarks: string }>
  captureUrl: string
}

/** The proof of delivery: the delivery note plus what the receiver gave, and the evidence files themselves. */
export interface PodData extends Omit<DeliveryNoteData, 'captureUrl'> {
  /** Where the finished POD can be read (printed and clickable in the footer, and its QR code). */
  viewUrl: string
  proof: {
    status: string; receivedAt: string; deviceTime: string
    receiverName: string; receiverPosition: string; receiverPhone: string; receiverEmail: string; receiverIdNumber: string
    courierName: string; courierPhone: string
    condition: string; conditionNote: string
    latitude: number | null; longitude: number | null; accuracyM: number | null; locationStatus: string; locationNote: string
    signature: Uint8Array; signatureSha256: string
    photos: Array<{ bytes: Uint8Array; sha256: string }>
  }
}
