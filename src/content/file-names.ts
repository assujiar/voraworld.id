/**
 * The name a downloaded file carries. A browser (an iPhone's above all) names a saved file after the last part of its address, so every download link ends in the file's own
 * name: "/admin/documents/12/pdf/LTR-VORA-C001-202610-00001 - Pemberitahuan.pdf" is saved as that, not as "pdf". The server rewrites such an address to the same route
 * (next.config.ts), whose Content-Disposition carries the same name for every other browser. A name is the document's number (unique) and, for a document somebody
 * titled, its title.
 */
const UNSAFE = /[\\/:*?"<>|\u0000-\u001f]+/g

/** A file name from its parts: no path characters, single spaces, at most 120 characters, always ending in .pdf. */
export function fileName(...parts: Array<string | number | null | undefined>): string {
  const base = parts.map((p) => String(p ?? '').replace(UNSAFE, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean).join(' - ')
  return `${(base || 'document').slice(0, 120).trim()}.pdf`
}

/** The link to a download route, ending in the file's name. */
export const fileHref = (path: string, ...parts: Array<string | number | null | undefined>): string => `${path}/${encodeURIComponent(fileName(...parts))}`
