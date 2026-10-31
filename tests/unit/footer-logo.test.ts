import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { FOOTER_LOGO, PAD } from '../../src/motion/brand'

describe('footer logo motion', () => {
  it('is a whole number of seconds long so it loops without a seam', () => {
    expect(FOOTER_LOGO.frames % 30).toBe(0)
  })
  it('has a canvas larger than the logo by exactly the room the CSS takes back, so the logo stays where the image was', () => {
    const css = readFileSync('public/static/css/feedback.css', 'utf8'), pct = (n: number) => (n / 890 * 100).toFixed(3)
    expect(FOOTER_LOGO.w).toBe(890 + 2 * PAD.x)
    expect(css).toContain(`width:${pct(FOOTER_LOGO.w)}%`)
    expect(css).toContain(`margin:-${pct(PAD.top)}% -${pct(PAD.x)}% -${pct(PAD.bottom)}%`)
  })
  it('loops, and shows the static logo until the player is ready', () => {
    const src = readFileSync('src/components/site/FooterLogo.tsx', 'utf8')
    expect(src).toMatch(/\bloop\b/)
    expect(src).toContain('/static/assets/vora-reverse.svg')
  })
})
