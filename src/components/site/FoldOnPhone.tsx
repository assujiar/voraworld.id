'use client'
import { useEffect } from 'react'

/**
 * The lists in a solution band are `<details>` that are served open (so that without script, and on a wide screen, everything is there). On a phone they start folded, so that the page is
 * a column of short headings that open on a tap instead of a wall of text. It does nothing else, and it runs once.
 */
export function FoldOnPhone({ selector = '.v-band__cols details', below = 900 }: { selector?: string; below?: number }) {
  useEffect(() => {
    try {
      if (window.matchMedia(`(max-width:${below}px)`).matches) document.querySelectorAll(selector).forEach((d) => d.removeAttribute('open'))
    } catch { /* an old browser keeps them open, which is harmless */ }
  }, [selector, below])
  return null
}
