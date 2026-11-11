import type { ReactNode } from 'react'
import type { Locale } from '@/content'

/** Public chat deliberately renders a limited, safe Markdown subset: no raw HTML or arbitrary links. */
export function safeVoraPath(raw: string): string | null {
  let parsed: URL
  try { parsed = new URL(raw, 'https://voraworld.id') } catch { return null }
  if (parsed.protocol !== 'https:' || !['voraworld.id', 'www.voraworld.id'].includes(parsed.hostname)) return null
  if (parsed.username || parsed.password || parsed.port || parsed.search || parsed.hash) return null
  return /^\/(en|id)\/(request-quote|contact|services(?:\/[-a-z0-9]+){0,2}|faq|about|solutions|network|insights(?:\/[-a-z0-9]+)?|document-samples)\/?$/i.test(parsed.pathname) ? parsed.pathname : null
}

const INLINE = /\[([^\]\n]{1,100})\]\((https?:\/\/[^\s)]+|\/(?:en|id)\/[^\s)]+)\)|https?:\/\/(?:www\.)?voraworld\.id\/(?:en|id)\/[^\s<>)]+|\/(?:en|id)\/[a-z0-9/_?#&=%.-]+|\*\*[^*\n]+\*\*|__[^_\n]+__|(?<!\w)\*[^*\n]+\*|(?<!\w)_[^_\n]+_(?!\w)|`[^`\n]+`|~~[^~\n]+~~/gi

function RichAction({ href, label }: { href: string; label: string }) {
  return <a className="vora-agent-message-button" href={href} target="_blank" rel="noopener noreferrer">
    <span>{label}</span>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.15" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17 17 7"/><path d="M8.5 7H17v8.5"/></svg>
  </a>
}

export function renderAgentInline(content: string, locale: Locale, depth = 0): ReactNode[] {
  if (depth > 3) return [content]
  const nodes: ReactNode[] = []
  let cursor = 0
  for (const match of content.matchAll(INLINE)) {
    const start = match.index ?? 0
    if (start < cursor) continue
    if (start > cursor) nodes.push(content.slice(cursor, start))
    const text = match[0]
    const key = `inline-${start}`
    if (match[1] !== undefined && match[2] !== undefined) {
      const href = safeVoraPath(match[2])
      nodes.push(href ? <RichAction key={key} href={href} label={match[1]} /> : match[1])
    } else if (text.startsWith('http') || text.startsWith('/')) {
      // Guard against matching a path inside a third-party URL or an identifier.
      const prior = content[start - 1] ?? ''
      if (text.startsWith('/') && /[a-z0-9./]/i.test(prior)) nodes.push(text)
      else {
        const cleaned = text.replace(/[.,;:!?]+$/, '')
        const href = safeVoraPath(cleaned)
        const label = /request-quote/.test(href || '') ? (locale === 'id' ? 'Minta Penawaran' : 'Request a Quote') : (href?.split('/').filter(Boolean).at(-1)?.replace(/-/g, ' ') ?? '')
        nodes.push(href ? <RichAction key={key} href={href} label={label} /> : cleaned)
        const trailing = text.slice(cleaned.length)
        if (trailing) nodes.push(trailing)
      }
    } else if (text.startsWith('**') || text.startsWith('__')) {
      nodes.push(<strong key={key}>{renderAgentInline(text.slice(2, -2), locale, depth + 1)}</strong>)
    } else if (text.startsWith('*') || text.startsWith('_')) {
      nodes.push(<em key={key}>{renderAgentInline(text.slice(1, -1), locale, depth + 1)}</em>)
    } else if (text.startsWith('`')) {
      nodes.push(<code key={key}>{text.slice(1, -1)}</code>)
    } else if (text.startsWith('~~')) {
      nodes.push(<s key={key}>{renderAgentInline(text.slice(2, -2), locale, depth + 1)}</s>)
    } else nodes.push(text)
    cursor = start + text.length
  }
  if (cursor < content.length) nodes.push(content.slice(cursor))
  return nodes.length ? nodes : [content]
}

type Block = { type: 'paragraph' | 'heading' | 'ul' | 'ol'; lines: string[] }
/** Paragraphs, small headings and proper ordered/unordered lists, preserving semantic HTML. */
function parseBlocks(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n?/g, '\n').trim().split('\n')
  const blocks: Block[] = []
  let current: Block | null = null
  const flush = () => { if (current?.lines.length) blocks.push(current); current = null }
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) { flush(); continue }
    const heading = /^#{1,3}\s+(.+)$/.exec(line)
    if (heading) { flush(); blocks.push({ type: 'heading', lines: [heading[1]] }); continue }
    const bullet = /^(?:[-*•])\s+(.+)$/.exec(line)
    const number = /^\d{1,2}[.)]\s+(.+)$/.exec(line)
    const type = bullet ? 'ul' : number ? 'ol' : 'paragraph'
    const text = bullet?.[1] || number?.[1] || line
    if (!current || current.type !== type) { flush(); current = { type, lines: [] } }
    current.lines.push(text)
  }
  flush()
  return blocks
}

export function AgentRichText({ content, locale }: { content: string; locale: Locale }) {
  return <div className="vora-agent-richtext">
    {parseBlocks(content).map((block, i) => {
      if (block.type === 'heading') return <h4 key={i}>{renderAgentInline(block.lines[0], locale)}</h4>
      if (block.type === 'ul') return <ul key={i}>{block.lines.map((line, j) => <li key={j}>{renderAgentInline(line, locale)}</li>)}</ul>
      if (block.type === 'ol') return <ol key={i}>{block.lines.map((line, j) => <li key={j}>{renderAgentInline(line, locale)}</li>)}</ol>
      return <p key={i}>{block.lines.map((line, j) => <span key={j}>{j > 0 ? ' ' : null}{renderAgentInline(line, locale)}</span>)}</p>
    })}
  </div>
}
