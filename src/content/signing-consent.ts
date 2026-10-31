/** What a signer confirms before signing. Pure text and names, shared by the signing page (browser) and the server that records them. */
export const CONSENT_VERSION = 'consent-v1'
export const CONFIRMATIONS = ['reviewed_document', 'confirmed_version', 'confirmed_purpose', 'confirmed_placement', 'consent_to_sign'] as const
export type Confirmation = (typeof CONFIRMATIONS)[number]

export const CONFIRMATION_TEXT: Record<Confirmation, { en: string; id: string }> = {
  reviewed_document: { en: 'I have read the complete document.', id: 'Saya telah membaca dokumen secara lengkap.' },
  confirmed_version: { en: 'I confirm that the version and fingerprint (SHA-256) shown are the file I am signing.', id: 'Saya mengonfirmasi bahwa versi dan sidik jari (SHA-256) yang ditampilkan adalah berkas yang saya tandatangani.' },
  confirmed_purpose: { en: 'I confirm the purpose of my signature shown above.', id: 'Saya mengonfirmasi tujuan tanda tangan saya yang tertera di atas.' },
  confirmed_placement: { en: 'I confirm where my signing mark appears on the pages, as shown in the preview.', id: 'Saya mengonfirmasi posisi tanda tangan saya pada halaman, sebagaimana ditampilkan pada pratinjau.' },
  consent_to_sign: { en: 'I sign this document electronically, in my own name. I understand this is a non-certified electronic signature.', id: 'Saya menandatangani dokumen ini secara elektronik atas nama saya sendiri. Saya memahami ini adalah tanda tangan elektronik tidak tersertifikasi.' },
}
