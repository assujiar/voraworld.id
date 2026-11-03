import { makeT, type Locale } from '@/content'
import { visualAssets, type VisualAsset } from '@/content/visual-assets'
import { ObjectArt } from './ObjectArt'

/** Full compositions stay intact; the original transparent PNG is available for closer reading. */
export function IllustrationFigure({ asset, locale, caption, className = '', sizes }: { asset: VisualAsset; locale: Locale; caption?: string; className?: string; sizes?: string }) {
  const t = makeT(locale), original = visualAssets[asset].src
  return <figure className={`illustration-figure ${className}`}>
    <a className="illustration-figure__link" href={original} target="_blank" rel="noopener noreferrer" aria-label={t('Open the full-size illustration in a new tab', 'Buka ilustrasi ukuran penuh di tab baru')}>
      <ObjectArt asset={asset} sizes={sizes} />
    </a>
    <figcaption>{caption ? <span>{caption} </span> : null}<a className="v-link" href={original} target="_blank" rel="noopener noreferrer">{t('View full size', 'Lihat ukuran penuh')} <span aria-hidden="true">↗</span></a></figcaption>
  </figure>
}
