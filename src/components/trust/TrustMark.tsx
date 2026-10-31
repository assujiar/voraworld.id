import { GLYPHS, GLYPH_BOX, GLYPH_STROKE } from '@/content/glyphs'
import { ICON_ART, WORDMARK_ART, type Art } from '@/content/stamp-art'
import { INK, RED, monoWidth, textWidth, type MarkLayout } from '@/content/trust-mark'
import { qrMatrix, qrPath } from '@/content/trust-qr'

/**
 * A VORA verification component as SVG: the same layout (content/verification-blocks.ts) the PDF is drawn from, with the approved artwork's own path data, the real line
 * icons and the real QR code of the address. The preview in the signing editor is this component, so what is shown is what prints.
 */
export function TrustMark({ layout, url, title, className, style }: { layout: MarkLayout; url: string; title?: string; className?: string; style?: React.CSSProperties }) {
  const sans = 'Helvetica, Arial, sans-serif', mono = '"Courier New", Courier, monospace'
  return (
    <svg className={className} style={style} viewBox={`0 0 ${layout.width} ${layout.height}`} width="100%" height="100%" preserveAspectRatio="xMinYMin meet" overflow="visible" role="img" aria-label={title ?? 'VORA verification mark'} xmlns="http://www.w3.org/2000/svg">
      {layout.badge ? <text x={0} y={-3} fontFamily={sans} fontWeight={700} fontSize={layout.badge.size} fill={RED}>{layout.badge.text}</text> : null}
      {layout.items.map((item, index) => {
        switch (item.t) {
          case 'icon': return <ArtShape key={index} art={ICON_ART} x={item.x} y={item.y} w={item.w} h={item.h} colors={[RED]} />
          case 'wordmark': return <ArtShape key={index} art={WORDMARK_ART} x={item.x} y={item.y} w={item.w} h={item.h} colors={[RED]} />
          case 'logo': return <ArtShape key={index} art={WORDMARK_ART} x={item.x} y={item.y} w={item.w} h={item.h} colors={[INK, RED]} />
          case 'rule': return <rect key={index} x={item.x} y={item.y} width={item.w} height={item.h} fill={item.color ?? RED} />
          case 'frame': return <rect key={index} x={item.x} y={item.y} width={item.w} height={item.h} rx={item.r} ry={item.r} fill={item.fill ?? 'none'} stroke={item.stroke} strokeWidth={item.width} />
          case 'line': return <line key={index} x1={item.x1} y1={item.y1} x2={item.x2} y2={item.y2} stroke={item.color} strokeWidth={item.width} />
          case 'glyph': return <path key={index} d={GLYPHS[item.name]} transform={`translate(${item.x} ${item.y}) scale(${item.size / GLYPH_BOX})`} fill="none" stroke={item.color} strokeWidth={GLYPH_STROKE} strokeLinecap="round" strokeLinejoin="round" />
          case 'hotspot': return null
          case 'qr': return (
            <g key={index}>
              <rect x={item.x} y={item.y} width={item.size} height={item.size} fill="#FFFFFF" />
              <path d={qrPath(qrMatrix(url), item.x, item.y, item.size).d} fill={INK} shapeRendering="crispEdges" />
            </g>
          )
          case 'text': {
            const isMono = item.font === 'mono'
            return (
              <text key={index} x={item.x} y={item.y} fontFamily={isMono ? mono : sans} fontWeight={item.bold ? 700 : 400} fontSize={item.size} fill={item.color}
                textLength={item.fit ?? (isMono ? monoWidth(item.text, item.size) : textWidth(item.text, item.size, item.bold))} lengthAdjust={item.fit ? 'spacing' : 'spacingAndGlyphs'}>{item.text}</text>
            )
          }
        }
      })}
    </svg>
  )
}

/** An approved SVG's own paths, scaled into a box (the box keeps the artwork's proportions, so the scale is the same both ways). */
function ArtShape({ art, x, y, w, h, colors }: { art: Art; x: number; y: number; w: number; h: number; colors: string[] }) {
  const [vx, vy, vw, vh] = art.viewBox
  return (
    <g transform={`translate(${x} ${y}) scale(${w / vw} ${h / vh}) translate(${-vx} ${-vy})`}>
      {art.paths.map((p, i) => <path key={i} d={p.d} fill={colors[Math.min(i, colors.length - 1)]} fillRule={p.evenOdd ? 'evenodd' : 'nonzero'} />)}
    </g>
  )
}
