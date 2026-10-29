import { PDFDocument, PDFName, PDFString, StandardFonts } from 'pdf-lib'

interface Options {
  pages?: number
  /** Adds an /OpenAction that runs JavaScript when the file is opened. */
  openActionScript?: boolean
  /** Adds a document-level JavaScript name tree entry. */
  namedScript?: boolean
  /** Marks the file as encrypted (the /Encrypt trailer entry is enough for readers to refuse it). */
  encrypted?: boolean
}

/** A small, valid PDF whose text layer contains `lines`, with optional hostile features for the negative tests. */
export async function makePdf(lines: string[], opts: Options = {}): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (let p = 0; p < (opts.pages ?? 1); p++) {
    const page = doc.addPage([595, 842])
    lines.forEach((line, i) => page.drawText(line, { x: 50, y: 780 - i * 22, size: 12, font }))
    page.drawText(`Page ${p + 1}`, { x: 50, y: 40, size: 9, font })
  }
  const ctx = doc.context
  if (opts.openActionScript) doc.catalog.set(PDFName.of('OpenAction'), ctx.obj({ S: 'JavaScript', JS: PDFString.of('app.alert(1)') }))
  if (opts.namedScript) {
    const action = ctx.register(ctx.obj({ S: 'JavaScript', JS: PDFString.of('app.alert(2)') }))
    const tree = ctx.register(ctx.obj({ Names: [PDFString.of('x'), action] }))
    doc.catalog.set(PDFName.of('Names'), ctx.obj({ JavaScript: tree }))
  }
  if (opts.encrypted) ctx.trailerInfo.Encrypt = ctx.register(ctx.obj({ Filter: 'Standard', V: 1, R: 2 }))
  return doc.save()
}
