import { documentType, type Family } from './document-types'

/**
 * What the document-trust system does for each kind of document, in one place. Nothing else in the code base asks "is this an invoice?" to decide whether it
 * is verified or may be signed: it asks this policy. A new kind of document gets its behaviour by being added here.
 *
 * Three separate questions, never merged:
 *   issuance      Was this exact file issued by VORA?            (every document: required)
 *   signing       Did an authorised individual sign it?           (only where the policy allows it, and then through the ceremony)
 *   integrity     Is the file in my hand the one that was issued? (the visitor checks it, locally)
 * and a fourth that is live and never printed into a file: the business status (payment, delivery, approval).
 */
export type TrustKind = 'invoice' | 'receipt' | 'quotation' | 'prepayment' | 'delivery' | 'pod' | 'document'
export const TRUST_KINDS: readonly TrustKind[] = ['invoice', 'receipt', 'quotation', 'prepayment', 'delivery', 'pod', 'document']
export const isTrustKind = (v: unknown): v is TrustKind => TRUST_KINDS.includes(v as TrustKind)

export type Lang = 'id' | 'en'
type Bi = Record<Lang, string>

/**
 * Whether a personal electronic signature made inside VORA (non-certified) is enough for the document:
 *   allowed                 the ceremony may run
 *   legal_review_required   it may run only after a person has recorded a legal review of this document (UU 1/2024 art. 17(2a): a high-risk electronic
 *                           transaction needs an electronic signature secured by an electronic certificate; whether a document is one is a legal judgement)
 *   certified_required      it may not run: execute the document with a certificate-backed signature outside VORA and upload the evidence
 *   not_applicable          the document is not signed by a person (it is issued and verified)
 */
export type NonCertified = 'allowed' | 'legal_review_required' | 'certified_required' | 'not_applicable'
export type Signing = 'none' | 'optional' | 'conditional' | 'party_based'

export interface TrustPolicy {
  kind: TrustKind
  /** The family the signer's authority is scoped by (a document family, or the business document kind). */
  family: string
  signing: Signing
  nonCertified: NonCertified
  /** The parties tracked for this document, when it needs more than VORA. */
  multiParty: boolean
  /** What opening the verification page does and does not confirm. */
  confirms: Bi
  doesNotConfirm: Bi
  /**
   * `immutable`: the PDF is archived when it is issued and every download is those bytes. `live`: the PDF is drawn from the business record each time, as it always was,
   * because its body shows a status that changes (the payment status of an invoice and of a receipt's invoice, the approval address and state of a quotation);
   * archiving it would freeze that status or take it out of the document. A `live` document still has its verification record, mark and link, and the verification page
   * reads the live status; it has no recorded file fingerprint, and the page says so. Changing this flag is the whole switch.
   */
  archive: 'immutable' | 'live'
  /**
   * Which verification components the document carries (decided here and nowhere else): Signature Type 1 when a regular VORA document is signed, Signature Type 2
   * for third-party documents and agreements (which carry no verification footer), and Footer Type 3 on every page of every other VORA document.
   */
  signature: 1 | 2
  footer: 'type3' | 'none'
  /** The live status the page reads from the business record, if any. */
  liveStatus: 'payment' | 'receipt' | 'prepayment' | 'approval' | 'delivery' | 'pod' | 'validity' | null
}

const BASE = { archive: 'immutable' as const, signature: 1 as const, footer: 'type3' as const }

const FIXED: Record<Exclude<TrustKind, 'document'>, TrustPolicy> = {
  invoice: {
    ...BASE, archive: 'live', kind: 'invoice', family: 'invoice', signing: 'optional', nonCertified: 'allowed', multiParty: false, liveStatus: 'payment',
    confirms: { id: 'VORA menerbitkan invoice ini. Status pembayaran di bawah dibaca langsung dari catatan keuangan VORA.', en: 'VORA issued this invoice. The payment status below is read live from VORA\'s finance records.' },
    doesNotConfirm: { id: 'Berkas PDF tidak berubah ketika status pembayaran berubah. Pemindaian QR tidak membuktikan bahwa berkas di tangan Anda belum diubah.', en: 'The PDF does not change when the payment status does. Scanning the QR does not show that the file you hold is unmodified.' },
  },
  receipt: {
    ...BASE, archive: 'live', kind: 'receipt', family: 'receipt', signing: 'conditional', nonCertified: 'allowed', multiParty: false, liveStatus: 'receipt',
    confirms: { id: 'VORA menerbitkan tanda terima pembayaran resmi ini setelah Keuangan VORA mengonfirmasi dana diterima.', en: 'VORA issued this official payment receipt after VORA Finance confirmed the funds.' },
    doesNotConfirm: { id: 'Bea meterai elektronik diterapkan secara terpisah dan statusnya ditampilkan sebagaimana tercatat.', en: 'The e-meterai is applied separately and its status is shown as recorded.' },
  },
  prepayment: {
    ...BASE, kind: 'prepayment', family: 'prepayment', signing: 'conditional', nonCertified: 'allowed', multiParty: false, liveStatus: 'prepayment',
    confirms: { id: 'VORA menerbitkan tanda terima pra-pembayaran ini.', en: 'VORA issued this pre-payment receipt.' },
    doesNotConfirm: { id: 'Tanda terima pra-pembayaran bukan bukti bahwa dana sudah diterima. Bukti pembayaran hanyalah tanda terima pembayaran resmi VORA.', en: 'A pre-payment receipt is not proof that payment was made. Payment is proven only by VORA\'s official payment receipt.' },
  },
  quotation: {
    ...BASE, archive: 'live', kind: 'quotation', family: 'quotation', signing: 'conditional', nonCertified: 'allowed', multiParty: false, liveStatus: 'approval',
    confirms: { id: 'VORA menerbitkan Surat Perjanjian Harga (penawaran) ini. Persetujuan pelanggan dan validasi akhir VORA adalah tahap terpisah.', en: 'VORA issued this Price Agreement Letter (quotation). The customer\'s acceptance and VORA\'s final validation are separate steps.' },
    doesNotConfirm: { id: 'Persetujuan pelanggan dan validasi akhir VORA adalah tahap terpisah dan ditampilkan sebagaimana tercatat.', en: 'The customer\'s acceptance and VORA\'s final validation are separate steps and are shown as recorded.' },
  },
  delivery: {
    ...BASE, kind: 'delivery', family: 'delivery', signing: 'none', nonCertified: 'not_applicable', multiParty: false, liveStatus: 'delivery',
    confirms: { id: 'VORA menerbitkan surat jalan ini.', en: 'VORA issued this delivery note.' },
    doesNotConfirm: { id: 'Verifikasi ini tidak membuktikan bahwa barang telah diterima. Bukti pengiriman adalah dokumen terpisah.', en: 'This verification does not show that the goods were delivered. Proof of delivery is a separate document.' },
  },
  pod: {
    ...BASE, kind: 'pod', family: 'pod', signing: 'none', nonCertified: 'not_applicable', multiParty: false, liveStatus: 'pod',
    confirms: { id: 'VORA menerbitkan dokumen bukti pengiriman ini dari bukti yang dicatat saat serah terima.', en: 'VORA issued this proof-of-delivery document from the evidence recorded at handover.' },
    doesNotConfirm: { id: 'Tanda tangan di layar dan foto adalah bukti serah terima yang dicatat saat pengiriman.', en: 'The on-screen signature and photographs are handover evidence recorded at delivery.' },
  },
}

const GENERAL: Record<Family, { signature?: 1 | 2; footer?: 'type3' | 'none'; signing: Signing; nonCertified: NonCertified; multiParty: boolean; confirms: Bi; doesNotConfirm: Bi; liveStatus: TrustPolicy['liveStatus'] }> = {
  letter: { signing: 'conditional', nonCertified: 'allowed', multiParty: false,
    confirms: { id: 'VORA menerbitkan surat ini.', en: 'VORA issued this letter.' }, doesNotConfirm: { id: 'Tanda tangan pribadi, bila ada, ditampilkan terpisah sebagai bukti penandatanganan.', en: 'A personal signature, where there is one, is shown separately as signing evidence.' }, liveStatus: null },
  billing: { signing: 'conditional', nonCertified: 'allowed', multiParty: false,
    confirms: { id: 'VORA menerbitkan surat tagihan ini atas faktur yang tercantum.', en: 'VORA issued this billing letter for the invoices it lists.' }, doesNotConfirm: { id: 'Status pembayaran faktur yang tercantum dibaca dari catatan keuangan, bukan dari surat.', en: 'The payment status of the listed invoices comes from finance records, not from the letter.' }, liveStatus: null },
  parties: { signing: 'conditional', nonCertified: 'allowed', multiParty: false,
    confirms: { id: 'VORA menerbitkan dokumen ini.', en: 'VORA issued this document.' }, doesNotConfirm: { id: 'Identitas pihak yang membuat pernyataan atau pemberi kuasa dicatat melalui bukti penandatanganan di bawah, bila ada.', en: 'The identity of the declarant or grantor is recorded through the signing evidence below, where there is any.' }, liveStatus: null },
  certificate: { signing: 'conditional', nonCertified: 'allowed', multiParty: false,
    confirms: { id: 'VORA menerbitkan sertifikat ini kepada pemegang yang tercantum.', en: 'VORA issued this certificate to the holder named.' }, doesNotConfirm: { id: 'Masa berlaku dan pencabutan dibaca langsung dari catatan VORA.', en: 'Validity and revocation are read live from VORA\'s records.' }, liveStatus: 'validity' },
  agreement: { signature: 2, footer: 'none', signing: 'party_based', nonCertified: 'legal_review_required', multiParty: true,
    confirms: { id: 'VORA menerbitkan naskah perjanjian ini.', en: 'VORA issued this agreement text.' }, doesNotConfirm: { id: 'Perjanjian belum dinyatakan terlaksana penuh sampai semua pihak yang disyaratkan menandatangani atau bukti pelaksanaan eksternal divalidasi.', en: 'The agreement is not fully executed until every required party has signed or external execution evidence has been validated.' }, liveStatus: null },
  seal: { signature: 2, footer: 'none', signing: 'optional', nonCertified: 'allowed', multiParty: false,
    confirms: { id: 'VORA mendaftarkan dan menyetempel berkas pihak lain ini. Berkas asli disimpan utuh.', en: 'VORA registered and marked this third-party file. The original is preserved unchanged.' }, doesNotConfirm: { id: 'VORA tidak membuktikan keaslian penerbit eksternal atau isi dokumennya.', en: 'VORA does not establish the authenticity of the external issuer or the content of the document.' }, liveStatus: null },
}

/**
 * Types whose legal weight differs from the rest of their family. A statement and a power of attorney carry formalities of their own (who the declarant or grantor is,
 * and whether the law asks for more than an electronic signature), so signing them in VORA waits for a recorded legal review; a certification or assignment letter is
 * VORA speaking for itself and does not.
 */
const TYPE_OVERRIDES: Record<string, Partial<Pick<TrustPolicy, 'nonCertified'>>> = {
  statement: { nonCertified: 'legal_review_required' },
  authorization: { nonCertified: 'legal_review_required' },
}

const UNKNOWN_DOCUMENT: TrustPolicy = {
  ...BASE, kind: 'document', family: 'document', signing: 'none', nonCertified: 'not_applicable', multiParty: false, liveStatus: null,
  confirms: { id: 'VORA menerbitkan dokumen ini.', en: 'VORA issued this document.' }, doesNotConfirm: { id: 'Jenis dokumen ini belum memiliki kebijakan tanda tangan.', en: 'This kind of document has no signing policy.' },
}

/** The policy of a verification kind; for a general document, of its type (`documentKind` is `documents.kind`). */
export function trustPolicy(kind: TrustKind, documentKind?: string): TrustPolicy {
  if (kind !== 'document') return FIXED[kind]
  const type = documentKind ? documentType(documentKind) : undefined
  if (!type) return UNKNOWN_DOCUMENT
  return { ...BASE, kind: 'document', family: type.family, ...GENERAL[type.family], ...TYPE_OVERRIDES[type.key] } as TrustPolicy
}

export type Eligibility =
  | { ok: true; needsLegalReview: boolean }
  | { ok: false; reason: 'no_signing' | 'certified_required'; message: Bi }

/** May a person sign this document inside VORA, and does it first need a recorded legal review? */
export function signingEligibility(policy: TrustPolicy): Eligibility {
  if (policy.signing === 'none' || policy.nonCertified === 'not_applicable') {
    return { ok: false, reason: 'no_signing', message: { id: 'Dokumen jenis ini tidak ditandatangani secara pribadi; dokumen ini diterbitkan dan diverifikasi.', en: 'This kind of document is not signed by a person; it is issued and verified.' } }
  }
  if (policy.nonCertified === 'certified_required') {
    return { ok: false, reason: 'certified_required', message: { id: 'Dokumen ini memerlukan tanda tangan elektronik tersertifikasi. Lakukan penandatanganan dengan penyelenggara tersertifikasi di luar VORA, lalu unggah buktinya.', en: 'This document needs a certificate-backed electronic signature. Execute it with a certified provider outside VORA and upload the evidence.' } }
  }
  return { ok: true, needsLegalReview: policy.nonCertified === 'legal_review_required' }
}

/** Only a document that is not void and has an issued file can be signed. */
export const SIGNING_PURPOSES = ['verified', 'approved', 'acknowledged', 'signed'] as const
export type SigningPurpose = (typeof SIGNING_PURPOSES)[number]
export const PURPOSE_LABELS: Record<Lang, Record<SigningPurpose, string>> = {
  id: { verified: 'Diperiksa dan disahkan oleh', approved: 'Disetujui oleh', acknowledged: 'Diketahui oleh', signed: 'Ditandatangani oleh' },
  en: { verified: 'Checked and endorsed by', approved: 'Approved by', acknowledged: 'Acknowledged by', signed: 'Signed by' },
}
