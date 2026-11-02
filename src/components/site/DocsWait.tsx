'use client'
import { PageLoader } from '@/components/feedback/VoraLoader'

/** The wait for a document page (verification, delivery proof, quotation approval): read from the database each time, and opened from phones, often on a slow connection. */
export default function DocsWait() {
  return <PageLoader variant="logo" label="Loading the document… / Memuat dokumen…" />
}
