import { BrandMotion } from '@/components/atelier/BrandMotion'

/** Study 01, automatic when visible; the original wordmark remains the no-script fallback. */
export function FooterLogo() {
  return <div className="v-footer__identity"><BrandMotion study="trace" tone="dark" loop /></div>
}
