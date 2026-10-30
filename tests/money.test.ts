import { describe, expect, it } from 'vitest'
import { amountInWords, calcLines, englishWords, money, units } from '@/server/money'

describe('units / money', () => {
  it('converts to minor units with half-up rounding', () => {
    expect(units('12.35', 'USD')).toBe(1235)
    expect(units('12.5', 'IDR')).toBe(13)
    expect(units('12.4999', 'IDR')).toBe(12)
    expect(units('-12.5', 'IDR')).toBe(-13)          // away from zero, as ROUND_HALF_UP
    expect(units('0.005', 'USD')).toBe(1)
    expect(units(' 1000 ', 'IDR')).toBe(1000)
    expect(units('.5', 'USD')).toBe(50)
  })
  it('rejects anything that is not a plain decimal', () => {
    for (const bad of ['', 'abc', '1e3', 'NaN', 'Infinity', '1,000', '1.2.3', '--1', null, undefined]) {
      expect(() => units(bad as never, 'IDR')).toThrow('Invalid monetary value')
    }
  })
  it('formats with grouping and the right decimals', () => {
    expect(money(2670500, 'IDR')).toBe('IDR 2,670,500')
    expect(money(-200000, 'IDR')).toBe('IDR -200,000')
    expect(money(123450, 'USD')).toBe('USD 1,234.50')
    expect(money(5, 'USD')).toBe('USD 0.05')
    expect(money(0, 'IDR')).toBe('IDR 0')
  })
})

describe('calcLines', () => {
  it('matches the previous implementation', () => {
    expect(calcLines([{ description: 'test', quantity: '1.5', price: '100', unit: 'ea' }], 'USD', '11').totalMinor).toBe(16650)
  })
  it('applies discount, tax and withholding to the net amount', () => {
    const r = calcLines([{ description: 'a', quantity: '1', price: '1500000' }, { description: 'b', quantity: '1', price: '1000000' }], 'IDR', '11', '2', 50000)
    expect(r.subtotalMinor).toBe(2500000)
    expect(r.taxMinor).toBe(269500)
    expect(r.withholdingMinor).toBe(49000)
    expect(r.totalMinor).toBe(2670500)       // the figure used throughout the e2e scenarios
  })
  it('keeps fractional quantities exact', () => {
    const r = calcLines([{ description: 'x', quantity: '2.5', price: '333.33' }], 'USD')
    expect(r.items[0]).toMatchObject({ priceMinor: 33333, amountMinor: 83333 })   // 83332.5 -> 83333
  })
  it('handles amounts beyond 32 bits', () => {
    const r = calcLines([{ description: 'big', quantity: '1', price: '2500000000' }], 'IDR', '11')
    expect(r.subtotalMinor).toBe(2_500_000_000)
    expect(r.totalMinor).toBe(2_775_000_000)
  })
  it('rejects invalid input', () => {
    const line = { description: 'x', quantity: '1', price: '10' }
    expect(() => calcLines([{ ...line, quantity: '0' }], 'IDR')).toThrow('Invalid quantity or price')
    expect(() => calcLines([{ ...line, quantity: '1000001' }], 'IDR')).toThrow('Invalid quantity or price')
    expect(() => calcLines([{ ...line, price: '-1' }], 'IDR')).toThrow('Invalid quantity or price')
    expect(() => calcLines([line], 'IDR', '101')).toThrow('Tax percentage out of range')
    expect(() => calcLines([line], 'IDR', '0', '-1')).toThrow('Tax percentage out of range')
    expect(() => calcLines([line], 'IDR', '0', '0', 11)).toThrow('Discount exceeds subtotal')
  })
  it('truncates over-long descriptions and units', () => {
    const r = calcLines([{ description: 'd'.repeat(600), quantity: '1', price: '1', unit: 'u'.repeat(40) }], 'IDR')
    expect(r.items[0].description).toHaveLength(500)
    expect(r.items[0].unit).toHaveLength(30)
  })
})

describe('englishWords', () => {
  it('is exact for representative values', () => {
    expect(englishWords(0)).toBe('Zero')
    expect(englishWords(25000000)).toBe('Twenty-Five Million')
    expect(englishWords(120050000)).toBe('One Hundred Twenty Million Fifty Thousand')
    expect(englishWords(2_500_000_000)).toBe('Two Billion Five Hundred Million')
    expect(() => englishWords(-1)).toThrow()
  })
})

describe('amountInWords', () => {
  it('writes the amount out in its own currency, with the minor unit where the currency has one', () => {
    expect(amountInWords(12_500_000, 'IDR')).toBe('Twelve Million Five Hundred Thousand Indonesian Rupiah')
    expect(amountInWords(123456, 'USD')).toBe('One Thousand Two Hundred Thirty-Four US Dollars and Fifty-Six Cents')
    expect(amountInWords(10000, 'USD')).toBe('One Hundred US Dollars')
    expect(amountInWords(101, 'EUR')).toBe('One Euro and One Cent')
    expect(amountInWords(56, 'SGD')).toBe('Fifty-Six Cents')
    expect(amountInWords(0, 'USD')).toBe('Zero US Dollars')
    expect(amountInWords(250_000, 'JPY')).toBe('Two Hundred Fifty Thousand Japanese Yen')
  })
  it('stays silent about what it cannot write: a negative amount or one beyond the supported range', () => {
    expect(amountInWords(-5, 'IDR')).toBe('')
    expect(amountInWords(2_000_000_000_000_000, 'IDR')).toBe('')
  })
})
