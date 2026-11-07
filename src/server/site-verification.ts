import type { Metadata } from 'next'

/**
 * Search-engine ownership tokens entered in Site Settings. An administrator may paste either the bare token or the whole
 * `<meta name="..." content="...">` tag the search engine shows; only the token is kept, and anything that is not a plain
 * token (letters, digits, `-`, `_`, `.`, `=`) is dropped so the field can never inject markup.
 */
export function verificationToken(raw: string | undefined | null): string {
  const value = String(raw ?? '').trim()
  if (!value) return ''
  const fromTag = /content\s*=\s*["']([^"']*)["']/i.exec(value)
  const token = (fromTag ? fromTag[1] : value).trim()
  return /^[A-Za-z0-9_.=-]{1,200}$/.test(token) ? token : ''
}

/** The `verification` block of the public layout metadata: Google Search Console and Bing Webmaster Tools. */
export function verificationMetadata(settings: Record<string, string | undefined>): Metadata['verification'] | undefined {
  const google = verificationToken(settings.google_site_verification)
  const bing = verificationToken(settings.bing_site_verification)
  if (!google && !bing) return undefined
  return { ...(google ? { google } : {}), ...(bing ? { other: { 'msvalidate.01': bing } } : {}) }
}
