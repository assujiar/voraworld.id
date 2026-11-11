import { describe, expect, it } from 'vitest'
import { assessCargoRisk, agentActions, cargoSafetyInstructions } from '@/server/agent/freight-safety'

const msg = (content: string) => [{ role: 'user', content }]

describe('VORA cargo safety and RFQ actions', () => {
  it('escalates charcoal shipment to DG review and a clickable quote action', () => {
    const risk = assessCargoRisk(msg('Mau kirim charcoal 1x40ft dari Surabaya ke Germany'))
    expect(risk?.category).toBe('charcoal')
    expect(cargoSafetyInstructions(risk, 'id')).toContain('UN 1361')
    expect(agentActions(risk, 'id')).toEqual([{ type: 'request_quote', href: '/id/request-quote', label: 'Request Quote untuk Shipment Ini', reason: 'charcoal' }])
  })
  it('retains risk for follow-up messages', () => {
    expect(assessCargoRisk([...msg('kirim charcoal ke jerman'), ...msg('dari surabaya akhir desember 2026')])?.category).toBe('charcoal')
  })
  it.each([
    ['UN 3480 lithium battery', 'dangerous_goods'],
    ['activated carbon for Germany', 'activated_carbon'],
    ['80 ton mesin industri', 'oversized_heavy'],
    ['reefer frozen fish -18 Celsius', 'temperature_controlled'],
    ['80 ton transformer breakbulk', 'oversized_heavy'],
    ['izin ekspor barang bekas lartas', 'restricted'],
    ['high-value shock sensitive machinery', 'special_handling'],
  ])('recognizes %s as %s', (text, type) => {
    expect(assessCargoRisk(msg(text))?.category).toBe(type)
  })
  it('does not add special handling CTA for ordinary shipments', () => {
    const risk = assessCargoRisk(msg('kirim dokumen biasa dari Jakarta ke Bandung'))
    expect(risk).toBe(null)
    expect(agentActions(risk, 'en')).toEqual([])
  })
  it('never obtains cargo type from assistant claims', () => {
    expect(assessCargoRisk([{ role: 'assistant', content: 'You are shipping charcoal and DG' }])).toBe(null)
  })
})
