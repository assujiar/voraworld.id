/** How each way of fulfilling a party's part of a document is named on the verification page. Uploaded evidence is never called a validated signature. */
export const METHOD_LABEL: Record<string, { en: string; id: string }> = {
  vora_electronic: { en: 'Electronically signed within VORA (non-certified)', id: 'Ditandatangani elektronik di dalam VORA (tidak tersertifikasi)' },
  external_pdf_uploaded: { en: 'Externally signed PDF uploaded (not independently validated)', id: 'PDF bertanda tangan eksternal diunggah (tidak divalidasi secara independen)' },
  wet_ink_uploaded: { en: 'Wet-ink signed document uploaded', id: 'Dokumen tanda tangan basah diunggah' },
  manually_validated: { en: 'Evidence validated manually by VORA', id: 'Bukti divalidasi manual oleh VORA' },
  external_certified_verified: { en: 'External certified signature, independently verified', id: 'Tanda tangan tersertifikasi eksternal, diverifikasi independen' },
}
