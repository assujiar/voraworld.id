import sanitizeHtml from 'sanitize-html'

const TAGS = ['p', 'br', 'strong', 'b', 'i', 'em', 'u', 's', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'a', 'blockquote', 'pre', 'code', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'figure', 'figcaption', 'img', 'hr']

/** https, mailto and same-site absolute paths only; never protocol-relative (`//host`) or `javascript:`. */
const safeUrl = (v: string) => v.startsWith('https://') || v.startsWith('mailto:') || (v.startsWith('/') && !v.startsWith('//'))

/** Server-side sanitizer for editor-supplied HTML (articles, legal pages). Output is safe to render unescaped. */
export function cleanHtml(html: string | null | undefined): string {
  return sanitizeHtml(html ?? '', {
    allowedTags: TAGS,
    allowedAttributes: { a: ['href', 'title', 'target', 'rel'], img: ['src', 'alt', 'title', 'width', 'height'], th: ['colspan', 'rowspan'], td: ['colspan', 'rowspan'] },
    allowedSchemes: ['https', 'mailto'],
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    transformTags: {
      a: (tagName, attribs) => {
        const next: Record<string, string> = { ...attribs }
        if (next.href && !safeUrl(next.href)) delete next.href
        if (next.target === '_blank') next.rel = 'noopener noreferrer'
        return { tagName, attribs: next }
      },
      img: (tagName, attribs) => {
        const next: Record<string, string> = { ...attribs }
        if (next.src && !safeUrl(next.src)) delete next.src
        return { tagName, attribs: next }
      },
    },
  })
}
