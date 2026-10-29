const ADDRESS = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}$/

/** A plain `name@host` address only: no display name, no header injection, no comma lists. */
export function emailAddress(value: unknown): string {
  const v = String(value ?? '').trim()
  if (v.length > 254 || !ADDRESS.test(v)) throw new Error('Invalid plain email address')
  return v
}
