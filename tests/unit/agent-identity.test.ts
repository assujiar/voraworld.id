import { describe, expect, it } from 'vitest'
import { normalizeEmail, normalizePhone, parseVisitorIdentity } from '@/server/agent/identity'

describe('VORA Virtual Agent visitor identity', () => {
  it('treats Indonesian phone spellings as the same contact', () => {
    const values = ['0819 4900 0094', '+62 819-4900-0094', '6281949000094', '81949000094', '+62 (819) 4900 0094']
    expect([...new Set(values.map(normalizePhone))]).toEqual(['6281949000094'])
  })
  it('normalizes email case and Gmail aliases but not unrelated providers', () => {
    expect(normalizeEmail(' Ari.Sujiar+sales@GoogleMail.com ')).toBe('arisujiar@gmail.com')
    expect(normalizeEmail('Ari.Sujiar+sales@Example.com')).toBe('ari.sujiar+sales@example.com')
  })
  it('rejects incomplete identity and requires company, email and phone', () => {
    const base = { name: 'Example Visitor', company: 'PT Contoh', email: 'visitor@example.com', phone: '+62 812 3456 7890' }
    expect(parseVisitorIdentity(base)?.phoneKey).toBe('6281234567890')
    expect(parseVisitorIdentity({ ...base, company: '' })).toBeNull()
    expect(parseVisitorIdentity({ ...base, email: 'wrong' })).toBeNull()
    expect(parseVisitorIdentity({ ...base, phone: '123' })).toBeNull()
  })
})
