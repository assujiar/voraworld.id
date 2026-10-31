/**
 * Canonical JSON: the one text a given value always becomes (keys sorted by code point, no spaces, integers only, no undefined), so that a signature or a hash
 * made over it today can be checked by anybody later, in any language that can sort keys. Anything that cannot be written unambiguously is refused.
 */
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json }

export function canonicalize(value: unknown): string {
  if (value === null) return 'null'
  switch (typeof value) {
    case 'boolean': return value ? 'true' : 'false'
    case 'string': return JSON.stringify(value.normalize('NFC'))
    case 'number':
      if (!Number.isSafeInteger(value)) throw new TypeError('Canonical JSON holds integers only: write other numbers as text')
      return String(value)
    case 'object': {
      if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`
      const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined)
      entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      return `{${entries.map(([k, v]) => `${JSON.stringify(k.normalize('NFC'))}:${canonicalize(v)}`).join(',')}}`
    }
    default: throw new TypeError(`Cannot write a ${typeof value} as canonical JSON`)
  }
}
