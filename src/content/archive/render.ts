import type { Locale } from '../index'
import { SOURCES } from './sources'
import type { LangDraft, Section } from './types'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const attr = (s: string) => esc(s).replace(/"/g, '&quot;')
/** `**bold**` and `[text](/site-path or https://…)`; the sanitiser still decides which links survive. */
const inline = (s: string) => esc(s)
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/\[([^\]]+)\]\((\/[^)\s]*|https:\/\/[^)\s]+)\)/g, (_m, t: string, u: string) => `<a href="${attr(u)}">${t}</a>`)

function section(s: Section): string {
  const out = [`<h2>${inline(s.h)}</h2>`]
  for (const p of s.p ?? []) out.push(`<p>${inline(p)}</p>`)
  if (s.list?.length) out.push(`<ul>${s.list.map((i) => `<li>${inline(i)}</li>`).join('')}</ul>`)
  if (s.steps?.length) out.push(`<ol>${s.steps.map((i) => `<li>${inline(i)}</li>`).join('')}</ol>`)
  if (s.table) out.push(`<table><thead><tr>${s.table.head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${s.table.rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`)
  if (s.example) out.push(`<blockquote><p><strong>${inline(s.example.label)}</strong></p>${s.example.p.map((p) => `<p>${inline(p)}</p>`).join('')}</blockquote>`)
  for (const p of s.after ?? []) out.push(`<p>${inline(p)}</p>`)
  return out.join('')
}

/** The article body as HTML the site's sanitiser accepts as is: sections, then the source list with the day each page was read. */
export function renderBody(draft: LangDraft, sourceIds: string[], locale: Locale): string {
  const heading = locale === 'en' ? 'Sources' : 'Sumber'
  const accessed = locale === 'en' ? 'accessed' : 'diakses'
  const pending = locale === 'en' ? 'access date to be rechecked before publication' : 'tanggal akses perlu diperiksa ulang sebelum terbit'
  const items = sourceIds.map((id) => {
    const s = SOURCES[id]
    return `<li><a href="${attr(s.url)}">${esc(s.title)}</a> (${s.accessed ? `${accessed} ${s.accessed}` : pending})</li>`
  })
  return draft.sections.map(section).join('') + `<h2>${heading}</h2><ul>${items.join('')}</ul>`
}

export const bodyWords = (draft: LangDraft) =>
  draft.sections.flatMap((s) => [s.h, ...(s.p ?? []), ...(s.list ?? []), ...(s.steps ?? []), ...(s.table ? [...s.table.head, ...s.table.rows.flat()] : []), ...(s.example ? [s.example.label, ...s.example.p] : []), ...(s.after ?? [])])
    .join(' ').split(/\s+/).filter(Boolean).length
