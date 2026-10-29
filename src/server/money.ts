/**
 * Exact decimal money arithmetic (no floating point anywhere). Amounts are integers of "minor units":
 * rupiah for IDR/JPY/KRW (no decimals), cents for everything else.
 * Rounding is half-up away from zero, identical to Python's ROUND_HALF_UP used by the previous version.
 */

/** A decimal number n / 10^s. */
interface Dec { n: bigint; s: number }

const DECIMAL_RE = /^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))$/

export function minorDecimals(currency: string): number {
  return ['IDR', 'JPY', 'KRW'].includes(currency) ? 0 : 2
}

export function parseDecimal(value: unknown, message = 'Invalid monetary value'): Dec {
  const m = DECIMAL_RE.exec(String(value ?? '').trim())
  if (!m) throw new Error(message)
  const [, sign, whole = '', frac1 = '', frac2 = ''] = m
  const frac = frac1 || frac2
  const n = BigInt((whole || '0') + frac)
  return { n: sign === '-' ? -n : n, s: frac.length }
}

const pow10 = (e: number) => 10n ** BigInt(e)

function mul(a: Dec, b: Dec): Dec { return { n: a.n * b.n, s: a.s + b.s } }

function roundHalfUp(a: Dec): bigint {
  if (a.s === 0) return a.n
  const d = pow10(a.s)
  let q = a.n / d
  const r = a.n % d
  const twice = (r < 0n ? -r : r) * 2n
  if (twice >= d) q += a.n < 0n ? -1n : 1n
  return q
}

function toSafeNumber(v: bigint): number {
  if (v > BigInt(Number.MAX_SAFE_INTEGER) || v < -BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Amount is too large')
  return Number(v)
}

/** "12.35" USD -> 1235; "12.5" IDR -> 13. */
export function units(value: unknown, currency = 'IDR'): number {
  const d = parseDecimal(value)
  return toSafeNumber(roundHalfUp(mul(d, { n: pow10(minorDecimals(currency)), s: 0 })))
}

/** Minor units -> "IDR 1,234,567" or "USD 1,234.50". */
export function money(minor: number | bigint, currency = 'IDR'): string {
  const decimals = minorDecimals(currency)
  const v = BigInt(minor)
  const abs = v < 0n ? -v : v
  const base = pow10(decimals)
  const whole = (abs / base).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const frac = decimals ? '.' + (abs % base).toString().padStart(decimals, '0') : ''
  return `${currency} ${v < 0n ? '-' : ''}${whole}${frac}`
}

export interface LineInput { description: string; quantity: unknown; price: unknown; unit?: string }
export interface Line { description: string; unit: string; quantity: string; priceMinor: number; amountMinor: number }
export interface Totals { items: Line[]; subtotalMinor: number; taxMinor: number; withholdingMinor: number; totalMinor: number }

function percent(value: unknown): Dec {
  const d = parseDecimal(value, 'Tax percentage out of range')
  if (d.n < 0n || d.n > 100n * pow10(d.s)) throw new Error('Tax percentage out of range')
  return d
}

/** Server-side invoice/quotation maths: line amounts, discount, tax and withholding on the net amount. */
export function calcLines(lines: LineInput[], currency: string, tax: unknown = '0', withholding: unknown = '0', discountMinor = 0): Totals {
  const items: Line[] = []
  let subtotal = 0n
  for (const line of lines) {
    const qty = parseDecimal(line.quantity, 'Invalid quantity or price')
    const priceMinor = units(line.price, currency)
    if (qty.n <= 0n || priceMinor < 0 || qty.n > 1_000_000n * pow10(qty.s)) throw new Error('Invalid quantity or price')
    const amount = roundHalfUp(mul(qty, { n: BigInt(priceMinor), s: 0 }))
    subtotal += amount
    items.push({
      description: String(line.description).slice(0, 500),
      unit: String(line.unit ?? 'unit').slice(0, 30),
      quantity: String(line.quantity).trim().replace(/^\+/, ''),
      priceMinor,
      amountMinor: toSafeNumber(amount),
    })
  }
  const net = subtotal - BigInt(Math.trunc(discountMinor))
  if (net < 0n) throw new Error('Discount exceeds subtotal')
  const t = percent(tax)
  const w = percent(withholding)
  const taxMinor = roundHalfUp({ n: net * t.n, s: t.s + 2 })
  const withholdingMinor = roundHalfUp({ n: net * w.n, s: w.s + 2 })
  const total = net + taxMinor - withholdingMinor
  if (total < 0n) throw new Error('Negative invoice')
  return {
    items,
    subtotalMinor: toSafeNumber(subtotal),
    taxMinor: toSafeNumber(taxMinor),
    withholdingMinor: toSafeNumber(withholdingMinor),
    totalMinor: toSafeNumber(total),
  }
}

const ONES = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

/** English cardinal wording for a non-negative whole number (printed on receipts). */
export function englishWords(value: number | bigint): string {
  let n = BigInt(value)
  if (n < 0n || n >= 10n ** 15n) throw new Error('Amount outside supported wording range')
  if (n === 0n) return 'Zero'
  const under1000 = (v: number): string => {
    const parts: string[] = []
    if (v >= 100) { parts.push(`${ONES[Math.floor(v / 100)]} Hundred`); v %= 100 }
    if (v >= 20) parts.push(TENS[Math.floor(v / 10)] + (v % 10 ? `-${ONES[v % 10]}` : ''))
    else if (v) parts.push(ONES[v])
    return parts.join(' ')
  }
  const parts: string[] = []
  for (const [base, label] of [[10n ** 12n, 'Trillion'], [10n ** 9n, 'Billion'], [10n ** 6n, 'Million'], [1000n, 'Thousand'], [1n, '']] as const) {
    const group = n / base
    n %= base
    if (group) parts.push(under1000(Number(group)) + (label ? ` ${label}` : ''))
  }
  return parts.join(' ')
}
