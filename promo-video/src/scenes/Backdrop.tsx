import React from "react";
import { AbsoluteFill } from "remotion";
import { C, EASE_IN, p, useT } from "../lib";
import { jakartaAt } from "../map";

const TICKER = "PT SATU ARAH INTERNATIONAL  ·  JAKARTA  ·  06°12′S 106°49′E  ·  FREIGHT & LOGISTICS  ·  ";

/** paper first half, ink second half, with the decor that keeps each frame from feeling empty */
export const Backdrop: React.FC = () => {
  const t = useT();
  const decorIn = p(t, 5.9, 6.6);
  const jk = jakartaAt(19.95);
  const flood = p(t, 19.85, 20.45, EASE_IN);
  const dark = t >= 20.45;
  const fg = dark ? "rgba(255,255,255,0.13)" : C.line;
  const tickerColor = dark ? "rgba(255,255,255,0.32)" : "rgba(100,113,124,0.75)";

  return (
    <AbsoluteFill>
      {/* paper + grain */}
      {!dark ? (
        <AbsoluteFill style={{ background: C.paper }}>
          <svg width={1080} height={1920} style={{ position: "absolute", inset: 0, opacity: 0.07, mixBlendMode: "multiply" }}>
            <filter id="grain">
              <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={Math.floor(t * 12) % 6} stitchTiles="stitch" />
              <feColorMatrix type="saturate" values="0" />
            </filter>
            <rect width={1080} height={1920} filter="url(#grain)" />
          </svg>
          {/* rotating bezel ring, a quiet nod to the clock that opens the film */}
          <svg width={1080} height={1920} style={{ position: "absolute", inset: 0, opacity: decorIn }}>
            <g transform={`translate(1010 1080) rotate(${t * 5})`}>
              <circle r={600} fill="none" stroke="#E3E5E1" strokeWidth={2} />
              <circle r={520} fill="none" stroke="#E7E9E6" strokeWidth={2} strokeDasharray="4 14" />
              {Array.from({ length: 72 }).map((_, i) => (
                <line key={i} x1={0} y1={-600} x2={0} y2={i % 6 === 0 ? -566 : -584} stroke="#D6DADB" strokeWidth={i % 6 === 0 ? 3 : 2} transform={`rotate(${i * 5})`} />
              ))}
            </g>
          </svg>
        </AbsoluteFill>
      ) : null}

      {/* ink stage */}
      {flood > 0 ? (
        <div
          style={{
            position: "absolute",
            left: jk.x - 2400 * flood,
            top: jk.y - 2400 * flood,
            width: 4800 * flood,
            height: 4800 * flood,
            borderRadius: "50%",
            background: C.ink,
          }}
        />
      ) : null}
      {dark ? (
        <AbsoluteFill style={{ background: C.ink }}>
          <AbsoluteFill
            style={{
              backgroundImage: "radial-gradient(rgba(255,255,255,0.07) 2px, transparent 2px)",
              backgroundSize: "48px 48px",
              backgroundPosition: `0px ${(-t * 10) % 48}px`,
              maskImage: "radial-gradient(circle at 50% 46%, black 25%, transparent 78%)",
              WebkitMaskImage: "radial-gradient(circle at 50% 46%, black 25%, transparent 78%)",
            }}
          />
          <AbsoluteFill style={{ background: "radial-gradient(circle at 50% 44%, rgba(255,255,255,0.07), rgba(255,255,255,0) 55%)" }} />
        </AbsoluteFill>
      ) : null}

      {/* frame furniture: hairlines and a slow vertical ticker on the right edge */}
      {t > 5.9 ? (
        <AbsoluteFill style={{ opacity: decorIn * (1 - p(t, 51.2, 51.6)) }}>
          <div style={{ position: "absolute", left: 80, top: 228, width: 920, height: 2, background: fg }} />
          <div style={{ position: "absolute", left: 80, top: 1664, width: 920, height: 2, background: fg }} />
          <div style={{ position: "absolute", left: 1020, top: 260, width: 40, height: 1380, overflow: "hidden" }}>
            <div
              style={{
                position: "absolute",
                left: 30,
                top: 0,
                transformOrigin: "0 0",
                rotate: "90deg",
                whiteSpace: "nowrap",
                fontSize: 19,
                fontWeight: 700,
                letterSpacing: "0.24em",
                color: tickerColor,
                translate: `${-((t * 45) % 1100)}px 0px`,
              }}
            >
              {TICKER.repeat(4)}
            </div>
          </div>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};
