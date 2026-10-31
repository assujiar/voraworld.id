'use client'
import type { PlayerRef } from '@remotion/player'
import { useRef, useState } from 'react'
import { AboutVerify, VERIFY } from '@/motion/about'
import { Stage } from './Stage'

/** A document, its stamp and QR code, and a button that scans it: the record answers. */
export function VerifyDemo({ scan, caption }: { scan: string; caption: string }) {
  const api = useRef<PlayerRef | null>(null)
  const [scanAt, setScanAt] = useState<number | null>(null)
  return (
    <figure className="ab-verify">
      <Stage component={AboutVerify as never} w={VERIFY.w} h={VERIFY.h} frames={VERIFY.frames} stillFrame={260} apiRef={api} inputProps={{ scanAt }}
        fallback={<img src="/static/assets/vora-a-icon-primary.svg" alt="" className="ab-fallback" width={160} height={90} />} />
      <figcaption>
        <button type="button" className="ab-btn" onClick={() => setScanAt((api.current?.getCurrentFrame() ?? 0) + 2)}>{scan}</button>
        <span>{caption}</span>
      </figcaption>
    </figure>
  )
}
