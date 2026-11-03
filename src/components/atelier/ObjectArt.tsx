import Image from 'next/image'
import { visualAssets, type VisualAsset } from '@/content/visual-assets'

/** Original artwork; the containing surface and information remain real HTML. */
export function ObjectArt({ asset, className = '', priority = false, alt = '', sizes = '(max-width: 600px) 92vw, (max-width: 1024px) 70vw, 720px' }: { asset: VisualAsset; className?: string; priority?: boolean; alt?: string; sizes?: string }) {
  const image = visualAssets[asset]
  return <Image src={image.src} width={image.width} height={image.height} alt={alt} priority={priority} sizes={sizes} quality={asset.startsWith('n') ? 90 : 75} className={`a-object ${className}`} data-vora-asset={asset} />
}
