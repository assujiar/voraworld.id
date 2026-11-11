import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { AgentRichText, safeVoraPath } from '@/components/site/AgentRichText'

function html(text: string, locale: 'id' | 'en' = 'id') {
  return renderToStaticMarkup(<AgentRichText content={text} locale={locale} />)
}

describe('VORA safe rich-text answer rendering', () => {
  it('renders emphasis, paragraphs and native punctuation without literal Markdown stars', () => {
    const result = html('Kami bantu *customs brokerage* dan **heavy-lift**.\n\nBoleh share detail shipment?')
    expect(result).toContain('<em>customs brokerage</em>')
    expect(result).toContain('<strong>heavy-lift</strong>')
    expect(result.match(/<p>/g)).toHaveLength(2)
    expect(result).not.toContain('*customs')
  })
  it('renders lists as semantic HTML with readable text', () => {
    const result = html('Untuk RFQ, siapkan:\n- HS Code\n- Gross weight\n- Port of discharge\n\n1. Kirim detail\n2. Tunggu konfirmasi')
    expect(result).toContain('<ul>')
    expect(result).toContain('<li>HS Code</li>')
    expect(result).toContain('<ol>')
    expect(result).toContain('<li>Kirim detail</li>')
  })
  it('makes approved internal links real, clickable buttons', () => {
    const result = html('Silakan [Request Quote](/id/request-quote) atau /id/contact.')
    expect(result).toContain('href="/id/request-quote"')
    expect(result).toContain('href="/id/contact"')
    expect(result).toContain('vora-agent-message-button')
    expect(result).not.toContain('[Request Quote]')
  })
  it('never renders model-provided HTML or links outside the allowlist', () => {
    const result = html('<script>alert(1)</script> [Klik](javascript:alert(1)) [External](https://evil.example/)')
    expect(result).not.toContain('<script>')
    expect(result).not.toContain('href="https://evil.example/"')
    expect(result).toContain('&lt;script&gt;')
    expect(safeVoraPath('https://evil.example/id/request-quote')).toBe(null)
    expect(safeVoraPath('/admin/leads')).toBe(null)
    expect(safeVoraPath('https://voraworld.id/en/request-quote')).toBe('/en/request-quote')
  })
})
