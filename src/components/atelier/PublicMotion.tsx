'use client'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { animate } from 'motion'
import { gsap } from 'gsap'
import { autoMotion } from '@/lib/auto-motion'

/** Progressive autoplay for the current editorial layout, including streamed CMS content.
 * Information is always visible. Controls and form fields are never animated. */
export function PublicMotion() {
  const pathname = usePathname()
  useEffect(() => {
    const main = document.getElementById('main')
    if (!main) return
    const known = new WeakSet<Element>(), cleanups: Array<() => void> = []
    const groups = [
      ['h1', 'heading'], ['.a-process', 'process'],
      ['.a-capability', 'card'], ['.v-index__item', 'directory'],
      ['.x-industry-plates > a', 'industry'], ['.a-records__sheet', 'records'],
      ['.a-brief__tray, .a-cover__art, .a-handling', 'cargo'], ['.a-illustration', 'illustration'],
    ] as const
    const scan = () => {
      for (const [selector, kind] of groups) for (const node of main.querySelectorAll<HTMLElement>(selector)) {
        if (known.has(node) || node.closest('.a-arrival') || (kind === 'illustration' && node.closest('.a-records__sheet'))) continue
        known.add(node); node.dataset.motionRegion = kind
        let context: gsap.Context | undefined, drift: ReturnType<typeof animate> | undefined, entered = false, active = false, generation = 0
        const image = node.querySelector<HTMLImageElement>('img.a-object')
        const restore = () => { generation++; active = false; context?.revert(); drift?.stop(); context = undefined; drift = undefined; entered = false }
        const stop = autoMotion(node, {
          play: () => {
            active = true
            if (entered) { context?.getTweens().forEach((tween: gsap.core.Tween) => tween.resume()); drift?.play(); return }
            entered = true
            const current = generation
            context = gsap.context(() => {
              const targets = kind === 'process' ? node.querySelectorAll('.a-process__n') : kind === 'heading' ? node : image ?? node
              gsap.fromTo(targets, { y: kind === 'heading' ? 10 : 8 }, { y: 0, duration: .9, stagger: .14, ease: 'power2.out', clearProps: 'transform', onComplete: () => {
                if (current !== generation || !image || !['card', 'industry', 'cargo'].includes(kind)) return
                // Never let the entrance and ambient animation compete for one transform.
                drift = animate(image, { y: [0, -3, 0] }, { duration: kind === 'industry' ? 11 : 9, repeat: Infinity, ease: 'easeInOut' })
                if (!active) drift.pause()
              } })
            }, node)
          },
          pause: () => { active = false; context?.getTweens().forEach((tween: gsap.core.Tween) => tween.pause()); drift?.pause() },
          reset: restore,
        }, image ? [image] : [])
        cleanups.push(() => { stop(); delete node.dataset.motionRegion })
      }
    }
    scan()
    const observer = new MutationObserver(scan)
    observer.observe(main, { childList: true, subtree: true })
    return () => { observer.disconnect(); cleanups.forEach(stop => stop()) }
  }, [pathname])
  return null
}
