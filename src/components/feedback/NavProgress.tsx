'use client'
import { usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * "Something is loading" for moving between pages. A bar runs along the top of the window from the moment an internal link is pressed until the next page is there, and the
 * link itself is marked as pending (dimmed, with a small ring in a menu), so that nobody has to wonder whether the press was taken. A link that opens a download or a new tab,
 * which has no page to wait for, is marked for a moment all the same, and a search or filter sent as a page request is treated like a link. It works for plain links (a full page load:
 * the new page replaces this one and the bar goes with it) and for client-side transitions (the address changes: the bar completes). The bar never claims a result: when
 * nothing arrives it stops by itself after a while. The same address, or a place on the same page, is left alone.
 */
const GIVE_UP_MS = 20_000
const ACK_MS = 1400
const NOT_A_PAGE = /(\.(pdf|csv|json|xml|zip|png|jpe?g|webp|svg)(\/|$)|\/(pdf|pod-pdf|source|file|artifact|evidence|ceremony|upload|uploads|static)(\/|$))/i

export function NavProgress() {
  const pathname = usePathname()
  const search = useSearchParams()?.toString() ?? ''
  const [phase, setPhase] = useState<'idle' | 'loading' | 'done'>('idle')
  const [label, setLabel] = useState('Memuat halaman…')
  const loading = useRef(false)
  const pendingLink = useRef<Element | null>(null)
  const timers = useRef<number[]>([])

  const clearTimers = () => { timers.current.forEach((t) => window.clearTimeout(t)); timers.current = [] }
  const finish = useCallback(() => {
    clearTimers()
    loading.current = false
    pendingLink.current?.removeAttribute('data-nav-pending'); pendingLink.current = null
    document.documentElement.removeAttribute('data-navigating')
    setPhase('idle')
  }, [])

  // The address is in place: the page has arrived (a client-side transition).
  useEffect(() => { if (loading.current) finish() }, [pathname, search, finish])

  const start = useCallback((control: Element) => {
    clearTimers()
    pendingLink.current?.removeAttribute('data-nav-pending')
    pendingLink.current = control; control.setAttribute('data-nav-pending', '')
    // Straight on the page, not through a render: the stylesheet draws the bar and the label from this attribute, so it shows at the next frame whatever React is doing.
    document.documentElement.setAttribute('data-navigating', '')
    loading.current = true
    setPhase('loading')
    timers.current.push(window.setTimeout(finish, GIVE_UP_MS))
  }, [finish])

  // A link that does not replace this page (a download, a new tab) has no bar to run, but the press is still acknowledged for a moment.
  const acknowledge = (control: Element) => {
    control.setAttribute('data-nav-pending', '')
    window.setTimeout(() => { if (pendingLink.current !== control) control.removeAttribute('data-nav-pending') }, ACK_MS)
  }

  // The label is in the language of the page: English on the English site, Indonesian everywhere else (the portal and the documents).
  useEffect(() => { setLabel(document.documentElement.lang === 'en' && !location.pathname.startsWith('/admin') && !/^\/(verify|pod|quotation-approval)\//.test(location.pathname) ? 'Loading…' : 'Memuat halaman…') }, [pathname])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const link = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!link || /\bexternal\b/.test(link.rel)) return
      let url: URL
      try { url = new URL(link.href, location.href) } catch { return }
      if (!/^https?:$/.test(url.protocol)) return
      const sameSite = url.origin === location.origin
      if ((link.target && link.target !== '_self') || link.hasAttribute('download') || (sameSite && NOT_A_PAGE.test(url.pathname))) { acknowledge(link); return }
      if (sameSite && url.pathname === location.pathname && url.search === location.search) return        // the same page, or a place in it
      start(link)
    }
    // A search or a filter sent as an ordinary page request (method get): the same as pressing a link.
    const onSubmit = (e: SubmitEvent) => {
      const form = e.target as HTMLFormElement | null
      if (!form || e.defaultPrevented || form.getAttribute('method')?.toLowerCase() !== 'get' || (form.target && form.target !== '_self')) return
      start((e.submitter as Element | null) ?? form)
    }
    // Coming back to a page kept by the browser (the back button): nothing is loading any more.
    const onShow = (e: PageTransitionEvent) => { if (e.persisted) { document.documentElement.removeAttribute('data-navigating'); if (loading.current) finish(); else setPhase('idle') } }
    document.addEventListener('click', onClick, true)
    document.addEventListener('submit', onSubmit, true)
    window.addEventListener('pageshow', onShow)
    return () => { document.removeEventListener('click', onClick, true); document.removeEventListener('submit', onSubmit, true); window.removeEventListener('pageshow', onShow); clearTimers() }
  }, [finish, start])

  return (
    <>
      <div className="nav-progress" aria-hidden="true" data-testid="nav-progress" />
      <div className="nav-chip" aria-hidden="true" data-testid="nav-chip"><span className="spin" /><span>{label}</span></div>
      <span className="sr-only" role="status" aria-live="polite">{phase === 'loading' ? label : ''}</span>
    </>
  )
}
