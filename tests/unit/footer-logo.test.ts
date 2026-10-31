import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { FOOTER_LOGO } from '../../src/motion/brand'

describe('footer logo motion', () => {
  it('is a whole number of seconds long so it loops without a seam', () => {
    expect(FOOTER_LOGO.frames % 30).toBe(0)
  })
  it('keeps the artwork proportions of the logo it replaces', () => {
    expect(FOOTER_LOGO.w / FOOTER_LOGO.h).toBeCloseTo(890 / 222, 1)
  })
  it('loops, and shows the static logo until the player is ready', () => {
    const src = readFileSync('src/components/site/FooterLogo.tsx', 'utf8')
    expect(src).toMatch(/\bloop\b/)
    expect(src).toContain('/static/assets/vora-reverse.svg')
  })
})
