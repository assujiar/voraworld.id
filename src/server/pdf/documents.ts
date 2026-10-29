import type { Db } from '../db'

// Placeholder until the PDF renderers are ported (phase 6).
export async function renderDocumentPdf(_db: Db, _kind: 'invoice' | 'receipt' | 'quotation', _id: number, _baseUrl: string): Promise<Uint8Array> {
  throw new Error('PDF rendering is not available yet')
}
