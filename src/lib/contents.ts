/** Contents list built from the headings of the (already sanitised) text; the ids are made here, from the heading text, never taken from the stored HTML. */
export function withContents(html: string): { html: string; toc: Array<{ id: string; text: string }> } {
  const toc: Array<{ id: string; text: string }> = []
  const used = new Set<string>()
  const out = html.replace(/<h2>([\s\S]*?)<\/h2>/g, (_m, inner: string) => {
    const text = inner.replace(/<[^>]+>/g, '').trim()
    let id = text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'section'
    while (used.has(id)) id += '-x'
    used.add(id); toc.push({ id, text })
    return `<h2 id="${id}">${inner}</h2>`
  })
  return { html: out, toc }
}

/** Article body ready to show: heading ids and a contents list, and every table inside a keyboard-focusable scroller so a wide table never widens the page. */
export function articleHtml(html: string, tableLabel: string): { html: string; toc: Array<{ id: string; text: string }> } {
  const { html: withIds, toc } = withContents(html)
  const label = tableLabel.replace(/[<>"&]/g, '')
  return { html: withIds.replace(/<table>/g, `<div class="v-tablewrap" role="region" aria-label="${label}" tabindex="0"><table>`).replace(/<\/table>/g, '</table></div>'), toc }
}
