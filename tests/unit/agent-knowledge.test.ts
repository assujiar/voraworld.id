import { describe, expect, it } from 'vitest'
import { validateKnowledgeInput } from '@/server/agent/knowledge-admin'
import { docxText } from '@/server/agent/document-import'

const valid = {
  category: 'operations', title_en: 'Project cargo', body_en: 'Handling special shipments requires checking dimensions, gross weight, lifting points, securing plans and the receiving terminal.',
  title_id: 'Project cargo', body_id: 'Untuk project cargo, lakukan review dimensi, berat, titik angkat, lashing dan kemampuan terminal tujuan.', source_url: '/en/services/project-cargo',
}

describe('knowledge editor validation', () => {
  it('accepts bilingual approved content and categorizes it', () => {
    expect(validateKnowledgeInput(valid).category).toBe('operations')
  })
  it('accepts one language, without fabricating a translation', () => {
    expect(validateKnowledgeInput({ ...valid, title_id: '', body_id: '' }).bodyId).toBe('')
  })
  it('rejects unpaired language fields', () => {
    expect(() => validateKnowledgeInput({ ...valid, body_id: '' })).toThrow()
  })
  it('rejects unsupported categories', () => {
    expect(() => validateKnowledgeInput({ ...valid, category: 'admin_secret' })).toThrow()
  })
  it('rejects executable links', () => {
    expect(() => validateKnowledgeInput({ ...valid, source_url: 'javascript:alert(1)' })).toThrow()
    expect(() => validateKnowledgeInput({ ...valid, source_url: '//bad.example' })).toThrow()
  })
  it('rejects empty articles and excessive text', () => {
    expect(() => validateKnowledgeInput({ ...valid, body_id: '', title_id: '', body_en: '' })).toThrow()
    expect(() => validateKnowledgeInput({ ...valid, body_en: 'X'.repeat(80_001) })).toThrow()
  })
})

describe('DOCX text extraction', () => {
  it('decodes Word text XML with paragraph boundaries and entities', () => {
    expect(docxText('<w:document><w:p><w:r><w:t>FCL &amp; LCL</w:t></w:r></w:p><w:p><w:r><w:t>Port of Jakarta</w:t></w:r></w:p></w:document>'))
      .toBe('FCL & LCL\nPort of Jakarta')
  })
})
