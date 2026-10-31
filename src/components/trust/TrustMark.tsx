import { ICON_ART, WORDMARK_ART, type Art } from '@/content/stamp-art'
import { INK, RED, textWidth, type MarkLayout } from '@/content/trust-mark'
import { qrMatrix, qrPath } from '@/content/trust-qr'

/**
 * The VORA Document Verification Mark as SVG: the same layout (content/trust-mark.ts) the PDF is drawn from, with the approved artwork's own path data, and the
 * real QR code of the address. The preview in the signing editor, and anything else on screen that shows the mark, is this component, so what is shown is what prints.
 * It has no background and no border: only the QR code sits on its own white square.
 */
export function TrustMark({ layout, url, title, className, style }: { layout: MarkLayout; url: string; title?: string; className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox={`0 0 ${layout.width} ${layout.height}`} width="100%" height="100%" preserveAspectRatio="xMinYMin meet" overflow="visible" role="img" aria-label={title ?? 'VORA verification mark'} xmlns="http://www.w3.org/2000/svg">
      {layout.badge ? <text x={0} y={-3} fontFamily="Helvetica, Arial, sans-serif" fontWeight={700} fontSize={layout.badge.size} fill={RED}>{layout.badge.text}</text> : null}
      {layout.items.map((item, index) => {
        switch (item.t) {
          case 'icon': return <ArtShape key={index} art={ICON_ART} x={item.x} y={item.y} w={item.w} h={item.h} />
          case 'wordmark': return <ArtShape key={index} art={WORDMARK_ART} x={item.x} y={item.y} w={item.w} h={item.h} />
          case 'rule': return <rect key={index} x={item.x} y={item.y} width={item.w} height={item.h} fill={item.color ?? RED} />
          case 'qr': return (
            <g key={index}>
              <rect x={item.x} y={item.y} width={item.size} height={item.size} fill="#FFFFFF" />
              <path d={qrPath(qrMatrix(url), item.x, item.y, item.size).d} fill={INK} shapeRendering="crispEdges" />
            </g>
          )
          case 'text': return (
            <text key={index} x={item.x} y={item.y} fontFamily="Helvetica, Arial, sans-serif" fontWeight={item.bold ? 700 : 400} fontSize={item.size} fill={item.color}
              textLength={item.fit ?? textWidth(item.text, item.size, item.bold)} lengthAdjust={item.fit ? 'spacing' : 'spacingAndGlyphs'}>{item.text}</text>
          )
        }
      })}
    </svg>
  )
}

/** An approved SVG's own paths, scaled into a box (the box keeps the artwork's proportions, so the scale is the same both ways). */
function ArtShape({ art, x, y, w, h }: { art: Art; x: number; y: number; w: number; h: number }) {
  const [vx, vy, vw, vh] = art.viewBox
  return (
    <g transform={`translate(${x} ${y}) scale(${w / vw} ${h / vh}) translate(${-vx} ${-vy})`} fill={RED}>
      {art.paths.map((p, i) => <path key={i} d={p.d} fillRule={p.evenOdd ? 'evenodd' : 'nonzero'} />)}
    </g>
  )
}
