import { documentType } from '../../content/document-types'
import { trustPolicy, type TrustKind, type TrustPolicy } from '../../content/trust-policy'
import { today } from '../dates'
import { many, one, rpc } from '../data'
import { findVerification } from '../verification'
import type { StoredFields } from '../documents/general'
import { verifyAttestation } from './attestation'

/**
 * What the public verification page says about a QR token, worked out from the records and nothing else. The page never says "authentic": it reports separate
 * findings (the record exists, VORA's issuance attestation checks out, a person signed, the file is the recorded one, the live business status) because they are separate
 * facts, and a registered token does not show that the file in a visitor's hand is unmodified. Nothing here exposes a customer, an amount, a signer's e-mail or any
 * authentication secret.
 */
export type Banner = 'record_found' | 'draft' | 'revoked' | 'superseded' | 'pending_emeterai' | 'awaiting_approval' | 'not_fully_executed' | 'incomplete' | 'unavailable'
export type IssuanceFinding = 'verified' | 'invalid_signature' | 'key_compromised' | 'not_attested' | 'legacy' | 'not_archived' | 'not_issued'
export type SigningFinding = 'not_applicable' | 'none_yet' | 'available' | 'incomplete'

export interface ArtifactView { version: number; role: 'issued' | 'signed'; sha256: string; issuedAt: string; attested: IssuanceFinding; keyId: string | null }
export interface SigningView { ref: string; purpose: string; signerName: string; signerPosition: string; signedAt: string; version: number; method: 'webauthn' }
export interface PartyView { role: string; name: string; required: boolean; fulfilled: boolean; method: string | null }

export interface VerifyModel {
  kind: TrustKind; label: string; labelId: string; reference: string; issuer: string; issuedOn: string
  banner: Banner
  policy: Pick<TrustPolicy, 'confirms' | 'doesNotConfirm' | 'signing' | 'archive'>
  /** The live business status, exactly as the records say, never printed into a file. */
  live: Array<{ label: { en: string; id: string }; value: string }>
  holder: { name: string; title: string; validUntil: string } | null
  source: { title: string; issuer: string; reference: string; originalSha256: string } | null
  issuance: IssuanceFinding
  signing: SigningFinding
  signings: SigningView[]
  artifacts: ArtifactView[]
  parties: PartyView[]
  executed: boolean | null
  chain: { ok: boolean; events: number } | null
  /** `immutable`: a recorded file; `live`: drawn from the records each time; `legacy`: made before the system, and says so. */
  assurance: 'archived' | 'live' | 'legacy'
  supersededBy: { token: string } | null
  revokedReason: string
}

export const METHOD_LABEL: Record<string, { en: string; id: string }> = {
  vora_electronic: { en: 'Electronically signed within VORA (non-certified)', id: 'Ditandatangani elektronik di dalam VORA (tidak tersertifikasi)' },
  external_pdf_uploaded: { en: 'Externally signed PDF uploaded (not independently validated)', id: 'PDF bertanda tangan eksternal diunggah (tidak divalidasi secara independen)' },
  wet_ink_uploaded: { en: 'Wet-ink signed document uploaded', id: 'Dokumen tanda tangan basah diunggah' },
  manually_validated: { en: 'Evidence validated manually by VORA', id: 'Bukti divalidasi manual oleh VORA' },
  external_certified_verified: { en: 'External certified signature, independently verified', id: 'Tanda tangan tersertifikasi eksternal, diverifikasi independen' },
}

export interface RawVerification {
  kind: TrustKind; documentKind?: string; number: string; issuedOn: string; status: string
  tokenRevoked: boolean; revokedReason: string; supersededByToken: string | null
  createdAt: Date | null; cutoff: string | null
  live: VerifyModel['live']; holder: VerifyModel['holder']; source: VerifyModel['source']
  stampPending: boolean
  artifacts: Array<{ id: number; version: number; role: 'issued' | 'signed'; sha256: string; createdAt: Date; attestation: { keyId: string; canonical: string; signature: string; publicKey: string | null; keyStatus: string | null } | null }>
  signings: SigningView[]; openRequests: number
  parties: PartyView[]
  chain: VerifyModel['chain']
  label: string; labelId: string
}

function attestationFinding(a: RawVerification['artifacts'][number]): IssuanceFinding {
  if (!a.attestation) return 'not_attested'
  const at = a.attestation
  if (!at.publicKey || !verifyAttestation(at.canonical, at.signature, at.publicKey)) return 'invalid_signature'
  // The attestation must describe THIS file: a valid signature over another file's description proves nothing about this one.
  try { if (JSON.parse(at.canonical).sha256 !== a.sha256) return 'invalid_signature' } catch { return 'invalid_signature' }
  return at.keyStatus === 'compromised' ? 'key_compromised' : 'verified'
}

/** Pure: the model from the raw facts. */
export function deriveView(raw: RawVerification): VerifyModel {
  const policy = trustPolicy(raw.kind, raw.documentKind)
  const artifacts: ArtifactView[] = raw.artifacts.map((a) => ({ version: a.version, role: a.role, sha256: a.sha256, issuedAt: a.createdAt.toISOString(), attested: attestationFinding(a), keyId: a.attestation?.keyId ?? null }))
  const latest = artifacts.at(-1)
  const revoked = raw.tokenRevoked || raw.status === 'void'
  const legacyDoc = !raw.cutoff || !raw.createdAt || raw.createdAt.getTime() < new Date(raw.cutoff).getTime()

  const issuance: IssuanceFinding = raw.status === 'draft' ? 'not_issued'
    : latest ? latest.attested
    : policy.archive === 'live' && !legacyDoc ? 'not_archived'
    : 'legacy'
  const signing: SigningFinding = policy.signing === 'none' ? 'not_applicable'
    : raw.signings.length ? (raw.openRequests > 0 ? 'incomplete' : 'available')
    : raw.openRequests > 0 ? 'incomplete' : 'none_yet'
  const requiredParties = raw.parties.filter((p) => p.required)
  const executed = raw.parties.length ? requiredParties.every((p) => p.fulfilled) : null

  let banner: Banner
  if (revoked) banner = raw.supersededByToken ? 'superseded' : 'revoked'
  else if (raw.status === 'draft') banner = 'draft'
  else if (raw.stampPending) banner = 'pending_emeterai'
  else if (raw.kind === 'quotation' && raw.status === 'awaiting_approval') banner = 'awaiting_approval'
  else if (raw.chain && !raw.chain.ok) banner = 'incomplete'
  else if (issuance === 'invalid_signature' || issuance === 'key_compromised') banner = 'incomplete'
  else if (executed === false) banner = 'not_fully_executed'
  else banner = 'record_found'

  return {
    kind: raw.kind, label: raw.label, labelId: raw.labelId, reference: raw.number, issuer: 'VORA | PT Satu Arah International', issuedOn: raw.issuedOn, banner, policy,
    live: revoked ? [] : raw.live, holder: revoked || raw.status === 'draft' ? null : raw.holder, source: revoked ? null : raw.source,
    issuance, signing, signings: raw.signings, artifacts, parties: raw.parties, executed, chain: raw.chain,
    assurance: latest ? 'archived' : policy.archive === 'live' && !legacyDoc ? 'live' : 'legacy',
    supersededBy: raw.supersededByToken ? { token: raw.supersededByToken } : null, revokedReason: raw.revokedReason,
  }
}

const TABLE = { invoice: 'invoices', receipt: 'receipts', quotation: 'quotations', prepayment: 'prepayment_receipts', document: 'documents', delivery: 'deliveries', pod: 'delivery_proofs' } as const
const LABELS_ID: Record<TrustKind, string> = { invoice: 'Faktur (Invoice)', receipt: 'Tanda Terima Pembayaran', quotation: 'Surat Perjanjian Harga', prepayment: 'Tanda Terima Pra-Pembayaran', document: 'Dokumen', delivery: 'Surat Jalan', pod: 'Bukti Pengiriman' }
const LABELS: Record<TrustKind, string> = { invoice: 'Invoice', receipt: 'Receipt', quotation: 'Price Agreement Letter', prepayment: 'Pre-Payment Receipt', document: 'Document', delivery: 'Delivery Note', pod: 'Proof of Delivery' }

/** Finds the token and gathers what the page reports. Null when there is no such token (the page then says so plainly, with no official look). */
export async function loadVerification(token: string): Promise<VerifyModel | null> {
  const row = await findVerification(token)
  if (!row || !(row.kind in TABLE)) return null
  const kind = row.kind as TrustKind
  const tok = await one('document_verification_tokens', (q) => q.eq('id', row.id), 'revoked_reason,superseded_by_kind,superseded_by_id')
  const doc = await one(TABLE[kind], (q) => q.eq('id', row.documentId))
  if (!doc) return null
  const delivery = kind === 'pod' ? await one('deliveries', (q) => q.eq('id', doc.deliveryId as number), 'number,status,created_at') : undefined
  const number = String(kind === 'pod' ? delivery?.number : doc.number)
  const status = String(kind === 'pod' ? (doc.status === 'submitted' ? 'issued' : 'void') : doc.status)

  // Live business status, read from the records now.
  const live: VerifyModel['live'] = []
  let invoiceState: string | undefined
  if (kind === 'invoice' || kind === 'prepayment') {
    const inv = kind === 'prepayment' ? await one('invoices', (q) => q.eq('id', doc.invoiceId as number), 'status') : doc
    invoiceState = inv?.status as string
    const prepaymentVoid = kind === 'prepayment' && invoiceState === 'void'
    if (!prepaymentVoid) live.push({ label: kind === 'prepayment' ? { en: 'Status of the invoice', id: 'Status faktur' } : { en: 'Payment status', id: 'Status pembayaran' }, value: invoiceState === 'paid' ? 'OFFICIALLY PAID | LUNAS' : invoiceState === 'partially_paid' ? 'PARTIALLY PAID | DIBAYAR SEBAGIAN' : 'AWAITING PAYMENT | MENUNGGU PEMBAYARAN' })
  }
  if (kind === 'delivery') live.push({ label: { en: 'Delivery note state', id: 'Status surat jalan' }, value: doc.status === 'delivered' ? 'PROOF OF DELIVERY RECORDED | BUKTI PENGIRIMAN TERCATAT' : 'ISSUED, NOT YET RECEIVED | DITERBITKAN, BELUM DITERIMA' })
  if (kind === 'pod') live.push({ label: { en: 'Proof of delivery', id: 'Bukti pengiriman' }, value: doc.status === 'submitted' ? 'RECORDED | TERCATAT' : 'REJECTED BY VORA FINANCE | DITOLAK' })
  if (kind === 'quotation') live.push({ label: { en: 'Customer approval', id: 'Persetujuan pelanggan' }, value: ({ approved: 'UPLOADED BY CUSTOMER, AWAITING VORA VALIDATION | DIUNGGAH PELANGGAN, MENUNGGU VALIDASI VORA', validated: 'VALIDATED BY VORA | DIVALIDASI VORA', awaiting_approval: 'AWAITING THE CUSTOMER | MENUNGGU PELANGGAN' } as Record<string, string>)[doc.status as string] ?? 'NOT REQUESTED | BELUM DIMINTA' })

  const general = kind === 'document' ? documentType(doc.kind as string) : undefined
  const stored = kind === 'document' ? (doc.fields as StoredFields | null) : null
  const values = stored?.values ?? {}
  const holder = general?.publicHolder ? { name: values.recipient_name ?? '', title: values.title ?? '', validUntil: values.valid_until ?? '' } : null
  const source = general?.family === 'seal' && stored?.source ? { title: values.source_title ?? '', issuer: values.source_issuer ?? '', reference: values.source_reference ?? '', originalSha256: stored.source.sha256 } : null
  const date = kind === 'receipt' ? today(doc.createdAt as Date) : String(kind === 'prepayment' ? '' : kind === 'document' ? doc.documentDate : kind === 'delivery' ? doc.deliveryDate : kind === 'pod' ? '' : doc.issuedAt ?? '')
  let issuedOn = date
  if (kind === 'prepayment') issuedOn = String((await one('invoices', (q) => q.eq('id', doc.invoiceId as number), 'issued_at'))?.issuedAt ?? '')
  if (kind === 'pod') issuedOn = today((doc.serverTime as Date) ?? new Date())

  const arts = await many('document_artifacts', (q) => q.eq('kind', kind).eq('document_id', row.documentId).order('version'))
  const artifacts: RawVerification['artifacts'] = []
  for (const a of arts) {
    const at = await one('document_attestations', (q) => q.eq('artifact_id', a.id as number), 'key_id,payload_canonical,signature')
    const key = at ? await one('attestation_keys', (q) => q.eq('key_id', at.keyId as string), 'public_key,status') : undefined
    artifacts.push({ id: a.id as number, version: a.version as number, role: a.role as 'issued' | 'signed', sha256: a.sha256 as string, createdAt: a.createdAt as Date,
      attestation: at ? { keyId: at.keyId as string, canonical: at.payloadCanonical as string, signature: at.signature as string, publicKey: (key?.publicKey as string) ?? null, keyStatus: (key?.status as string) ?? null } : null })
  }
  const events = await many('signing_events', (q) => q.eq('kind', kind).eq('document_id', row.documentId).order('id'), 'ref,purpose,signer_name,signer_position,signed_at,signed_artifact_id')
  const versionOf = new Map(arts.map((a) => [a.id as number, a.version as number]))
  const open = await many('signing_requests', (q) => q.eq('kind', kind).eq('document_id', row.documentId).eq('status', 'pending').gt('expires_at', new Date().toISOString()), 'id', 1)
  const parties = (await many('document_parties', (q) => q.eq('kind', kind).eq('document_id', row.documentId).order('id'))).map((p): PartyView => ({ role: p.role as string, name: p.name as string, required: Boolean(p.required), fulfilled: p.method !== null, method: (p.method as string) ?? null }))
  const chain = arts.length || events.length ? await rpc<{ ok: boolean; events: number }>('trust_verify_evidence', { p_kind: kind, p_document: row.documentId }) : null
  let supersededByToken: string | null = null
  if (tok?.supersededByKind && tok.supersededById) supersededByToken = ((await many('document_verification_tokens', (q) => q.eq('kind', tok.supersededByKind as string).eq('document_id', tok.supersededById as number).eq('revoked', false).order('id'), 'token', 1))[0]?.token as string) ?? null
  const cutoff = (await one('settings', (q) => q.eq('key', 'trust_enabled_at'), 'value'))?.value as string | undefined

  return deriveView({
    kind, documentKind: kind === 'document' ? (doc.kind as string) : undefined, number, issuedOn, status, tokenRevoked: row.revoked, revokedReason: String(tok?.revokedReason ?? ''), supersededByToken,
    createdAt: (kind === 'pod' ? (doc.serverTime as Date) : (doc.createdAt as Date)) ?? null, cutoff: cutoff ?? null, live, holder, source,
    stampPending: (kind === 'receipt' || kind === 'prepayment') && status === 'pending_stamp', artifacts,
    signings: events.map((e): SigningView => ({ ref: e.ref as string, purpose: e.purpose as string, signerName: e.signerName as string, signerPosition: e.signerPosition as string, signedAt: (e.signedAt as Date).toISOString(), version: versionOf.get(e.signedArtifactId as number) ?? 0, method: 'webauthn' })),
    openRequests: open.length, parties, chain, label: general ? general.label.en : LABELS[kind], labelId: general ? general.label.id : LABELS_ID[kind],
  })
}
