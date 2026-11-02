import { describe, expect, it } from 'vitest'
import { HERO, heroLogo } from '@/motion/about'

/** The logo in the About hero must always fit in the room under the copy, whatever the shape of the window (it was cut off at the bottom in wide, short windows). */
const LINE = (w: number, tall: boolean) => w * (tall ? 0.04 : 0.026) * 4.6 + 20

describe('the About hero logo', () => {
  // Window sizes (css px) with the height the hero takes (at least 640) and where the copy ends (about 290 to 390 px from the top of the hero, at every width).
  const windows: Array<[number, number, number]> = [[1305, 640, 339], [1450, 640, 356], [1044, 640, 288], [1948, 879, 373], [2560, 1024, 384], [1440, 824, 370], [1366, 692, 360], [1600, 640, 347], [1280, 640, 331], [1024, 692, 299], [768, 948, 288], [390, 768, 320], [360, 640, 306], [844, 640, 265]]
  for (const [w, h, copyBottom] of windows) {
    it(`fits in a ${w} px wide hero of ${h} px, with the line and the hint under it, and clear of the copy`, () => {
      const H = Math.round((HERO.w * h) / w), top = Math.round((copyBottom * HERO.w) / w)
      const logo = heroLogo(HERO.w, H, top)
      const tall = H / HERO.w > 1.05
      expect(logo.y, 'below the copy').toBeGreaterThanOrEqual(top - 1)
      expect(logo.y + logo.h + (LINE(logo.w, tall) - 20), 'the logo and its line stay inside the hero').toBeLessThanOrEqual(H)
      expect(logo.x, 'centred and inside').toBeGreaterThanOrEqual(0); expect(logo.x + logo.w).toBeLessThanOrEqual(HERO.w)
      expect(logo.w, 'still a logo, not a speck').toBeGreaterThan(HERO.w * 0.28)
    })
  }

  it('keeps the usual size when there is room', () => {
    expect(heroLogo(1600, 1000, 380).w).toBeCloseTo(1600 * 0.62, 5)
    expect(heroLogo(1600, 3400, 460).w).toBeCloseTo(1600 * 0.84, 5)                 // a phone held upright
  })

  it('shrinks the logo, instead of cutting it off, when the window is wide and short', () => {
    const roomy = heroLogo(1600, 1000, 380), tight = heroLogo(1600, 700, 380)
    expect(tight.w).toBeLessThan(roomy.w)
    expect(tight.y + tight.h).toBeLessThan(700)
  })
})
