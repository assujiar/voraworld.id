import { describe, expect, it } from 'vitest'
import { DOCUMENT_TYPES } from '@/content/document-types'
import { signingEligibility, trustPolicy, TRUST_KINDS, type TrustPolicy } from '@/content/trust-policy'
import { archiveEligible } from '@/server/trust/serve'

const CUTOFF = '2026-10-31T00:00:00.000Z'
const after = new Date('2026-11-01T00:00:00Z'), before = new Date('2026-10-01T00:00:00Z')

describe('policy', () => {
  it('gives every kind of document a policy, and every general type the policy of its family', () => {
    for (const k of TRUST_KINDS) expect(trustPolicy(k).confirms.en.length, k).toBeGreaterThan(10)
    for (const t of DOCUMENT_TYPES) { const p = trustPolicy('document', t.key); expect(p.family, t.key).toBe(t.family); expect(p.endMark, t.key).not.toBe(undefined) }
    expect(trustPolicy('document', 'no-such-type').signing).toBe('none')                 // an unknown type is verified and never signed
  })

  it('says only what verification confirms: a delivery note is not proof of delivery, a pre-payment receipt is not proof of payment, an agreement is not executed by being issued', () => {
    expect(trustPolicy('delivery').doesNotConfirm.en).toMatch(/does not show that the goods were delivered/)
    expect(trustPolicy('prepayment').doesNotConfirm.en).toMatch(/not proof that payment was made/)
    expect(trustPolicy('document', 'nda').doesNotConfirm.en).toMatch(/not fully executed until every required party has signed/)
    expect(trustPolicy('quotation').doesNotConfirm.en).toMatch(/acceptance and VORA's final validation are separate steps/)
  })

  it('does not require a personal signature of every document: invoices are optional, delivery notes and proofs of delivery are not signed here at all', () => {
    expect(trustPolicy('invoice').signing).toBe('optional')
    expect(signingEligibility(trustPolicy('delivery'))).toMatchObject({ ok: false, reason: 'no_signing' })
    expect(signingEligibility(trustPolicy('pod'))).toMatchObject({ ok: false, reason: 'no_signing' })
  })

  it('sends legally restricted documents to legal review, and never lets a certificate-required one through the non-certified ceremony (UU 1/2024 art. 17(2a))', () => {
    for (const key of ['authorization', 'statement', 'nda', 'cooperation_agreement', 'logistics_service_agreement']) expect(signingEligibility(trustPolicy('document', key)), key).toEqual({ ok: true, needsLegalReview: true })
    for (const key of ['letter', 'certificate', 'information', 'assignment', 'seal']) expect(signingEligibility(trustPolicy('document', key)), key).toEqual({ ok: true, needsLegalReview: false })
    const strict: TrustPolicy = { ...trustPolicy('document', 'authorization'), nonCertified: 'certified_required' }
    const e = signingEligibility(strict)
    expect(e).toMatchObject({ ok: false, reason: 'certified_required' })
    if (!e.ok) expect(e.message.en).toMatch(/certified provider outside VORA/)
  })

  it('tracks several parties only for agreements', () => {
    for (const t of DOCUMENT_TYPES) expect(trustPolicy('document', t.key).multiParty, t.key).toBe(t.family === 'agreement')
  })
})

describe('which PDFs are archived', () => {
  it('archives an issued document created after the system started', () => {
    for (const [kind, status] of [['prepayment', 'issued'], ['delivery', 'issued'], ['delivery', 'delivered'], ['pod', 'delivered']] as const) expect(archiveEligible(kind, { status, createdAt: after }, CUTOFF), kind).toBe(true)
    expect(archiveEligible('document', { status: 'issued', createdAt: after }, CUTOFF, 'letter')).toBe(true)
    expect(archiveEligible('document', { status: 'issued', createdAt: after }, CUTOFF, 'seal')).toBe(true)
  })
  it('never archives a document created before it (legacy stays legacy), a draft, a void one, or one released as a stamped file', () => {
    expect(archiveEligible('prepayment', { status: 'issued', createdAt: before }, CUTOFF)).toBe(false)
    for (const status of ['draft', 'void', 'pending_stamp']) expect(archiveEligible('prepayment', { status, createdAt: after }, CUTOFF)).toBe(false)
    expect(archiveEligible('prepayment', { status: 'issued', createdAt: after, stampRequired: true }, CUTOFF)).toBe(false)
    expect(archiveEligible('prepayment', { status: 'issued', createdAt: null }, CUTOFF)).toBe(false)
    expect(archiveEligible('prepayment', { status: 'issued', createdAt: after }, null)).toBe(false)           // the migration has not been applied
  })
  it('keeps invoices, receipts and quotations as they were drawn: their body shows a status that changes, so they are rendered live (and verified all the same)', () => {
    for (const kind of ['invoice', 'receipt', 'quotation'] as const) {
      expect(trustPolicy(kind).archive).toBe('live')
      expect(archiveEligible(kind, { status: kind === 'invoice' ? 'issued' : 'issued', createdAt: after }, CUTOFF)).toBe(false)
    }
  })
})
