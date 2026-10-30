'use client'

export interface PartyData { name: string; contact: string; phone: string; email: string; address: string }

/**
 * Copies the customer's details into one party's fields (`shipper_*` or `consignee_*`) when the person asks. It never runs by itself, because the
 * customer, the shipper and the consignee are different roles that are only sometimes the same company; and it asks before it replaces text that is
 * already there.
 */
export function PartyFill({ prefix, label, data }: { prefix: 'shipper' | 'consignee'; label: string; data: PartyData }) {
  const fill = (e: React.MouseEvent<HTMLButtonElement>) => {
    const form = e.currentTarget.form ?? e.currentTarget.closest('form')
    if (!form) return
    const target = (key: string) => form.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${prefix}_${key}"]`)
    const values: Record<string, string> = { name: data.name, contact: data.contact, phone: data.phone, email: data.email, address: data.address }
    const changes = Object.entries(values).filter(([k, v]) => { const el = target(k); return el && el.value.trim() !== '' && el.value.trim() !== v.trim() })
    if (changes.length && !window.confirm('Isian yang sudah ada akan diganti dengan data customer. Lanjutkan?')) return
    for (const [k, v] of Object.entries(values)) {
      const el = target(k)
      if (!el) continue
      const setter = Object.getOwnPropertyDescriptor(el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value')?.set
      setter?.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }
  }
  return <button type="button" className="button-outline" onClick={fill} style={{ minHeight: 40 }}>{label}</button>
}
