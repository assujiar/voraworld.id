import type { SearchItem } from '@/content/public-ux'

export const normalizeSearch = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
const stop = new Set(['i','a','the','to','for','my','can','do','how','is','and','saya','mau','yang','untuk','di','ke','dan','ini','itu','bisa','barang','kirim'])
export function rankSearch(items: SearchItem[], raw: string): SearchItem[] {
  const query = normalizeSearch(raw).slice(0, 100)
  if (!query) return []
  const tokens = query.split(' ').filter(t => t.length > 1 && !stop.has(t))
  return items.map((item, index) => {
    const title = normalizeSearch(item.title), body = normalizeSearch(item.body)
    const alias = (item.aliases ?? []).some(a => (' '+query+' ').includes(' '+normalizeSearch(a)+' '))
    const hits = tokens.filter(t => (' '+title+' '+body+' ').includes(' '+t+' ')).length
    const score = (alias ? 100 : 0) + (title.includes(query) ? 40 : 0) + (body.includes(query) ? 8 : 0) + tokens.reduce((n, t) => n + ((' '+title+' ').includes(' '+t+' ') ? 8 : 0), 0) + (hits === tokens.length && tokens.length ? 6 : 0)
    return {item, score: hits || alias || title.includes(query) ? score : 0, index}
  }).filter(x => x.score > 0).sort((a,b) => b.score-a.score || a.index-b.index).map(x => x.item)
}

/** Shortens text for a card at the last whole word, without trailing punctuation, and marks the cut with an ellipsis. */
export function clipText(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max + 1)
  const space = cut.lastIndexOf(' ')
  const words = (space > max * 0.6 ? cut.slice(0, space) : clean.slice(0, max)).replace(/[\s,;:.!?–—-]+$/, '')
  return `${words}…`
}

export type Need ='domestic' | 'international' | 'customs' | 'warehouse' | 'project'
export type Arrangement = 'road' | 'sea' | 'air' | 'unsure'
export function suggestedServices(need: Need, arrangement: Arrangement = 'unsure', shared = 'unsure'): string[] {
  if (need === 'customs') return ['customs-brokerage']
  if (need === 'warehouse') return ['3pl-warehousing']
  if (need === 'project') return ['project-cargo']
  if (need === 'international') return ['international-freight-forwarding']
  if (arrangement === 'unsure') return ['domestic-distribution']
  if (arrangement === 'air') return ['domestic-distribution/air-freight']
  const modes = arrangement === 'road' ? ['ftl', 'ltl'] : ['fcl', 'lcl']
  return (shared === 'dedicated' ? modes.slice(0,1) : shared === 'shared' ? modes.slice(1) : modes).map(m => `domestic-distribution/${m}`)
}

export const DRAFT_FIELDS = ['name','email','phone','company','mode','origin','destination','pickup','cargo','message'] as const
export function safeDraft(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object') return {}
  const input = raw as Record<string, unknown>, out: Record<string, string> = {}
  for (const key of DRAFT_FIELDS) if (typeof input[key] === 'string') out[key] = input[key].slice(0, key === 'cargo' || key === 'message' ? 6000 : key === 'phone' ? 40 : 200)
  return out
}
export function fieldError(name: string, value: string, required: boolean, locale: 'en'|'id', checked = false): string {
  const id = locale === 'id'
  if (name === 'consent') return required && !checked ? (id ? 'Centang persetujuan privasi sebelum mengirim.' : 'Please agree to the privacy notice before sending.') : ''
  if (name === 'phone') {
    // Keep the browser's guidance aligned with the existing server leadPhone contract.
    const phone = value.replace(/\u0000/g, '').trim()
    if (!phone) return required ? (id ? 'Isi nomor HP Anda.' : 'Enter your mobile number.') : ''
    if (!/^\+?[0-9][0-9\s().-]{4,28}[0-9]$/.test(phone) || phone.replace(/\D/g, '').length < 7 || phone.replace(/\D/g, '').length > 15) {
      return id ? 'Masukkan nomor HP yang valid dengan 7–15 digit, misalnya +62 812 3456 7890.' : 'Enter a valid mobile number with 7–15 digits, such as +62 812 3456 7890.'
    }
    return ''
  }
  if (required && !value.trim()) return id ? 'Bagian ini perlu diisi.' : 'Please fill in this field.'
  if (name === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return id ? 'Masukkan alamat email lengkap, misalnya nama@perusahaan.com.' : 'Enter a complete email address, such as name@company.com.'
  return ''
}
