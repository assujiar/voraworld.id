import { describe, expect, it } from 'vitest'
import { ACTIONS, busyLabel, uploadLabel } from '@/components/feedback/busy-labels'

describe('processing labels', () => {
  it('uses the explicit action key before the button text', () => {
    expect(busyLabel('Anything at all', 'customer.save')).toBe('Menyimpan Customer…')
    expect(busyLabel('Anything at all', 'quotation.validate')).toBe('Memvalidasi Quotation…')
    expect(busyLabel('Publish', 'article.publish')).toBe('Menerbitkan Artikel…')
    expect(busyLabel('Create invoice', 'invoice.create')).toBe('Menyiapkan Invoice…')
    expect(uploadLabel('Send', 'pod.submit')).toBe('Mengunggah Bukti Pengiriman…')
  })
  it('falls back to the text rules, and to a neutral label that names no result', () => {
    expect(busyLabel('Save customer')).toBe('Menyimpan Customer…')
    expect(busyLabel('Validate Quotation')).toBe('Memvalidasi Quotation…')
    expect(busyLabel('Something unmapped')).toBe('Memproses permintaan…')
  })
  it('never announces a finished result while the work is still running', () => {
    for (const a of Object.values(ACTIONS)) { expect(a.busy).toMatch(/…$/); expect(a.busy).not.toMatch(/berhasil|selesai|terkirim|dikirim\b/i) }
  })
})
