import { inflateRawSync } from 'node:zlib'
import { extractText, getDocumentProxy } from 'unpdf'
import { ActionError } from '@/server/errors'

export const AGENT_FILE_MAX_BYTES = 4 * 1024 * 1024
export const AGENT_TEXT_MAX_CHARS = 80_000

/** Reads one specified DOCX entry from the ZIP central directory (no external ZIP library). */
export function docxXml(bytes: Uint8Array): string {
  const buf = Buffer.from(bytes)
  if (buf.length < 32 || buf.readUInt32LE(0) !== 0x04034b50) throw new ActionError('Invalid DOCX file')
  let end = -1
  for (let i = buf.length - 22; i >= Math.max(0,buf.length-65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { end = i; break }
  }
  if (end < 0) throw new ActionError('Invalid DOCX archive')
  const entries = buf.readUInt16LE(end + 10)
  const base = buf.readUInt32LE(end + 16)
  if (entries > 3000 || base >= buf.length) throw new ActionError('DOCX is too complex')
  let pos = base
  for (let i = 0; i < entries; i++) {
    if (pos + 46 > buf.length || buf.readUInt32LE(pos) !== 0x02014b50) throw new ActionError('Invalid DOCX directory')
    const method = buf.readUInt16LE(pos + 10)
    const compressed = buf.readUInt32LE(pos + 20)
    const unpacked = buf.readUInt32LE(pos + 24)
    const nameLen = buf.readUInt16LE(pos + 28)
    const extraLen = buf.readUInt16LE(pos + 30)
    const commentLen = buf.readUInt16LE(pos + 32)
    const localOffset = buf.readUInt32LE(pos + 42)
    const name = buf.subarray(pos + 46, pos + 46 + nameLen).toString('utf8')
    pos += 46 + nameLen + extraLen + commentLen
    if (name !== 'word/document.xml') continue
    if (unpacked > 4 * 1024 * 1024 || compressed > AGENT_FILE_MAX_BYTES || ![0,8].includes(method)) throw new ActionError('DOCX text exceeds import limit')
    if (localOffset + 30 > buf.length || buf.readUInt32LE(localOffset) !== 0x04034b50) throw new ActionError('Invalid DOCX content')
    const offset = localOffset + 30 + buf.readUInt16LE(localOffset+26) + buf.readUInt16LE(localOffset+28)
    if (offset + compressed > buf.length) throw new ActionError('Incomplete DOCX content')
    const data = buf.subarray(offset, offset + compressed)
    let inflated: Buffer
    try { inflated = method === 8 ? inflateRawSync(data, { maxOutputLength: 4 * 1024 * 1024 }) : data } catch { throw new ActionError('Unable to read DOCX text') }
    if (inflated.length !== unpacked) throw new ActionError('Damaged DOCX text')
    return inflated.toString('utf8')
  }
  throw new ActionError('DOCX is missing its main text')
}

const decodeXml = (s: string): string => s.replace(/&(#x[0-9a-f]+|#[0-9]+|amp|lt|gt|quot|apos);/gi, (_, code: string) => {
  switch (code) { case 'amp': return '&'; case 'lt': return '<'; case 'gt': return '>'; case 'quot': return '"'; case 'apos': return "'" }
  const cp = code.toLowerCase().startsWith('#x') ? parseInt(code.slice(2),16) : parseInt(code.slice(1),10)
  return Number.isFinite(cp) && cp >= 32 && cp <= 0x10ffff ? String.fromCodePoint(cp) : ''
})

/** Extracts ordinary Word paragraph and table text. Does not execute XML, external links or embedded objects. */
export function docxText(xml: string): string {
  const cleaned = xml.replace(/<w:(?:tab|br|cr)\b[^>]*\/?\s*>/g, ' ')
    .replace(/<\/w:(?:p|tr)>/g, '\n').replace(/<\/w:tc>/g, '\t')
    .replace(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g, (_: string, t: string) => `\uE000${decodeXml(t)}\uE001`)
  return [...cleaned.matchAll(/\uE000([\s\S]*?)\uE001|\n|\t/g)]
    .map((m) => m[1] ?? m[0]).join('')
    .replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}

export async function extractKnowledgeDocument(file: Uint8Array, filename: string): Promise<{ text: string; type: string }> {
  if (file.length < 100 || file.length > AGENT_FILE_MAX_BYTES) throw new ActionError('File must be smaller than 4 MB')
  const extension = filename.toLowerCase().split('.').pop()
  let text = ''
  let type = ''
  if (extension === 'pdf') {
    if (Buffer.from(file.subarray(0,5)).toString('utf8') !== '%PDF-') throw new ActionError('Invalid PDF file')
    type = 'application/pdf'
    try {
      const pdf = await getDocumentProxy(file.slice())
      try { const value = await extractText(pdf, { mergePages: true }); text = value.text } finally { await (pdf as unknown as { destroy?: () => Promise<void> }).destroy?.().catch(() => undefined) }
    } catch { throw new ActionError('Unable to extract text from PDF (scanned pages need OCR first)') }
  } else if (extension === 'docx') {
    type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    text = docxText(docxXml(file))
  } else throw new ActionError('Only PDF and DOCX files are supported')
  text = text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ').trim()
  if (text.length < 80) throw new ActionError('This document has too little selectable text. OCR scanned files before uploading.')
  if (text.length > AGENT_TEXT_MAX_CHARS) throw new ActionError('Document exceeds 80,000 text characters; split it into smaller knowledge articles.')
  return { text, type }
}
