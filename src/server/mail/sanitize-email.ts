import sanitizeHtml from 'sanitize-html'

/**
 * Email-only HTML sanitization. The general website sanitizer intentionally strips
 * styling. Transactional email requires a restricted inline CSS vocabulary.
 * Nothing user-controlled may introduce scripts, forms, CSS URLs, or arbitrary
 * protocol links. Keep the allow-list short and test against malicious examples.
 */
const TAGS = [
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
  'div', 'span', 'p', 'br', 'h1', 'h2', 'h3', 'h4',
  'strong', 'b', 'em', 'i', 'a', 'img', 'ul', 'ol', 'li', 'hr'
]
const HEX = /^#[0-9a-fA-F]{3,8}$/
const SIZE = /^(?:auto|0|\d+(?:\.\d+)?(?:px|%)?)$/
const SPACE = /^(?:0|\d+(?:\.\d+)?px)(?: (?:0|\d+(?:\.\d+)?px)){0,3}$/
const BORDER = /^(?:0|\d{1,2}px (?:solid|dashed) #[0-9a-fA-F]{6})$/
const THEME_LINKS = /^\$(?:admin_url|pod_url|verify_url|approval_url)$/
const VALID_URL = /^(?:https:\/\/[^\s"'<>]+|mailto:[^\s"'<>]+|\/(?!\/)[^\s"'<>]*)$/i

function cleanLink(input: string, allowVariables: boolean): boolean {
  return VALID_URL.test(input) || (allowVariables && THEME_LINKS.test(input))
}

/**
 * allowVariables = true ONLY when an administrator saves a template; the final
 * rendered message is sanitised again with allowVariables = false.
 */
export function cleanEmailHtml(html: string, allowVariables = false): string {
  return sanitizeHtml(html, {
    allowedTags: TAGS,
    allowedAttributes: {
      '*': ['style', 'role', 'width', 'height', 'align', 'valign', 'bgcolor', 'border', 'cellpadding', 'cellspacing'],
      a: ['href', 'title', 'target', 'rel', 'style'],
      img: ['src', 'alt', 'width', 'height', 'style'],
    },
    allowedStyles: {
      '*': {
        'color': [HEX], 'background-color': [HEX],
        'width': [SIZE], 'min-width': [SIZE], 'max-width': [SIZE], 'height': [SIZE],
        'font-size': [SIZE], 'line-height': [SIZE], 'letter-spacing': [/^-?\d+(?:\.\d+)?px$/],
        'font-family': [/^(?:Arial|Helvetica|Verdana|Tahoma|Georgia|sans-serif|serif|[, ]+)+$/],
        'font-weight': [/^(?:400|500|600|700|800|normal|bold)$/],
        'text-align': [/^(?:left|right|center)$/],
        'text-decoration': [/^(?:none|underline)$/],
        'vertical-align': [/^(?:top|middle|bottom)$/],
        'display': [/^(?:block|inline|inline-block)$/],
        'margin': [SPACE], 'margin-top': [SPACE], 'margin-bottom': [SPACE],
        'padding': [SPACE], 'padding-top': [SPACE], 'padding-bottom': [SPACE],
        'padding-left': [SPACE], 'padding-right': [SPACE],
        'border': [BORDER], 'border-top': [BORDER], 'border-bottom': [BORDER],
        'border-left': [BORDER], 'border-right': [BORDER],
        'border-radius': [SIZE], 'border-collapse': [/^collapse$/],
      },
    },
    allowedSchemes: ['https', 'mailto'],
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    transformTags: {
      a: (tagName, attribs) => {
        const next = { ...attribs }
        if (next.href && !cleanLink(next.href, allowVariables)) delete next.href
        if (next.target === '_blank') next.rel = 'noopener noreferrer'
        return { tagName, attribs: next }
      },
      img: (tagName, attribs) => {
        const next = { ...attribs }
        // Only explicitly approved public asset hosts may render inline images.
        if (next.src && !/^https:\/\/(?:voraworld\.id|www\.voraworld\.id)\/static\/assets\/[a-zA-Z0-9._/-]+$/.test(next.src)) delete next.src
        return { tagName, attribs: next }
      },
    },
  })
}
