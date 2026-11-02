import Image from 'next/image';
import type { CSSProperties } from 'react';
import './vora-art.css';

// Example, not an automatic replacement for existing components.
// Build editorial text and the actual buttons outside this component.
export type VoraArtKey = 'home' | 'about' | 'services' | 'freight' | 'air-import' | 'sea-import' |
  'air-export' | 'sea-export' | 'customs' | 'warehouse' | 'domestic' | 'ftl' | 'ltl' |
  'fcl' | 'lcl' | 'domestic-air' | 'project' | 'solutions' | 'network' | 'insights' |
  'faq' | 'contact' | 'rfq' | 'admin' | 'privacy' | 'terms';

export function VoraScene({
  page, priority = false, alt = '', className = ''
}: { page: VoraArtKey; priority?: boolean; alt?: string; className?: string }) {
  return (
    <div className={`vora-hero-art ${className}`}>
      <div className="vora-hero-art__ambient" aria-hidden="true" />
      <Image
        className="vora-hero-art__visual"
        src={`/vora-visual/scenes/vora-scene-${page}.webp`}
        width={1480}
        height={1000}
        priority={priority}
        alt={alt}
        sizes="(max-width: 720px) 100vw, (max-width: 1100px) 85vw, 55vw"
      />
    </div>
  );
}

// For bespoke page sections, combine a raw original cutout with a transparent SVG.
export function VoraLayeredArtwork({
  object, graphic = 'clay-pedestal-oval', alt = ''
}: { object: string; graphic?: string; alt?: string }) {
  return (
    <div className="vora-layered-art">
      <img className="vora-layered-art__stage" src={`/vora-visual/graphics/${graphic}.svg`} alt="" aria-hidden="true" />
      <Image className="vora-layered-art__object" src={`/vora-visual/objects/${object}.webp`}
        alt={alt} width={1254} height={1254} sizes="(max-width: 720px) 100vw, 48vw" />
    </div>
  );
}
