import { describe, expect, it } from 'vitest'
import { fileHref, fileName } from '@/content/file-names'
import { pdfResponse } from '@/server/http'

describe('the name of a downloaded file', () => {
  it('is the document number and its title, so that one document differs from another', () => {
    expect(fileName('LTR-VORA-C001-202610-00001', 'Pemberitahuan')).toBe('LTR-VORA-C001-202610-00001 - Pemberitahuan.pdf')
    expect(fileName('LTR-VORA-C001-202610-00001')).not.toBe(fileName('LTR-VORA-C001-202610-00002'))
  })
  it('never carries a path character, and is never just "pdf"', () => {
    expect(fileName('A/B', 'x:y*z?"<>|\\w')).toBe('A B - x y z w.pdf')
    expect(fileName('', null)).toBe('document.pdf')
    expect(fileName('N', 'x'.repeat(300)).length).toBeLessThanOrEqual(124)
  })
  it('ends the link in the file name, encoded', () => {
    expect(fileHref('/admin/documents/12/pdf', 'SEL-1', 'Kontrak PT Mitra')).toBe('/admin/documents/12/pdf/SEL-1%20-%20Kontrak%20PT%20Mitra.pdf')
  })
  it('is sent in full in the response header, with an ASCII fallback', () => {
    const h = pdfResponse(new Uint8Array([1]), 'SEL-1 - Kontrak “Nusantara” é.pdf').headers.get('content-disposition')!
    expect(h).toContain('filename="SEL-1 - Kontrak _Nusantara_ _.pdf"')
    expect(h).toContain("filename*=UTF-8''SEL-1%20-%20Kontrak%20%E2%80%9CNusantara%E2%80%9D%20%C3%A9.pdf")
    expect(pdfResponse(new Uint8Array([1]), 'x.pdf', 'attachment').headers.get('content-disposition')).toMatch(/^attachment;/)
  })
})
