'use client'
import { FOOTER_LOGO, FooterLogoLoop } from '@/motion/brand'
import { Stage } from '@/components/about/Stage'

/**
 * The footer's VORA logo, moving without end (see motion/brand.tsx). The still logo is what shows until the loop is fetched (it is fetched only when the footer is near the screen)
 * and without script, in the same box so that nothing moves on the page when it arrives; a visitor who asked for less motion keeps the still logo.
 */
export function FooterLogo() {
  return (
    <Stage
      component={FooterLogoLoop as never} w={FOOTER_LOGO.w} h={FOOTER_LOGO.h} frames={FOOTER_LOGO.frames} stillFrame={0} loop inputProps={{}} className="v-footer__logo"
      fallback={<img src="/static/assets/vora-reverse.svg" alt="" className="v-footer__logo-img" width={150} height={44} />}
    />
  )
}
