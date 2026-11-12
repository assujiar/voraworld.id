import React from "react";
import { AbsoluteFill } from "remotion";
import { geoDistance } from "d3-geo";
import dotsRaw from "../mapDots.json";
import { C, EASE, EASE_IN, mix, p, useT } from "../lib";
import {
  arcPath,
  CENTER,
  INDO,
  INDO_STEP,
  INDO_T0,
  JAKARTA,
  LonLat,
  projectionFor,
  viewAt,
  visible,
  WORLD,
  WORLD_STEP,
  WORLD_T0,
} from "../map";

/** label nudges where two cities sit close together */
const LABEL_OFF: Record<string, [number, number]> = { Hamburg: [-150, -44], Rotterdam: [12, 4], Busan: [14, -26], Tokyo: [14, -50] };

const DOTS = dotsRaw as [number, number, number][];
const DIST = DOTS.map((d) => geoDistance([d[0], d[1]], JAKARTA) * (180 / Math.PI));

const circlePath = (x: number, y: number, r: number) =>
  `M${(x - r).toFixed(1)} ${y.toFixed(1)}a${r.toFixed(2)} ${r.toFixed(2)} 0 1 0 ${(2 * r).toFixed(2)} 0a${r.toFixed(2)} ${r.toFixed(2)} 0 1 0 ${(-2 * r).toFixed(2)} 0`;

const LINE = "Domestic and international logistics, coordinated from Jakarta.".split(" ");
const INTL = "The international leg, planned with pickup, documentation and destination delivery.".split(" ");

export const MapScene: React.FC = () => {
  const t = useT();
  if (t < 19.85 || t > 32.05) return null;
  const v = viewAt(t);
  const proj = projectionFor(v);
  const reveal = (t - 19.95) * 75; // degrees of the world revealed around Jakarta
  const zoomOut = p(t, 24.2, 25.6);
  const rIndo = Math.max(0.8, Math.min(3.4, (v.scale / 1150) * 3.4));
  const rWorld = Math.max(0.6, Math.min(2.6, (v.scale / 400) * 2.2));

  let dWorld = "";
  let dIndo = "";
  let dFresh = "";
  for (let i = 0; i < DOTS.length; i++) {
    if (DIST[i] > reveal) continue;
    const ll: LonLat = [DOTS[i][0], DOTS[i][1]];
    if (!visible(v, ll)) continue;
    const pt = proj(ll);
    if (!pt) continue;
    if (pt[0] < -20 || pt[0] > 1100 || pt[1] < -20 || pt[1] > 1940) continue;
    const fresh = reveal - DIST[i] < 6;
    const r = DOTS[i][2] ? rIndo : rWorld;
    const c = circlePath(pt[0], pt[1], fresh ? r * 1.3 : r);
    if (fresh) dFresh += c;
    else if (DOTS[i][2]) dIndo += c;
    else dWorld += c;
  }

  const jk = proj(JAKARTA) ?? [CENTER.x, CENTER.y];
  const textIn = p(t, 20.6, 21.1);
  const textOut = p(t, 30.9, 31.3, EASE_IN);
  const globeK = p(t, 24.2, 25.2) * (1 - p(t, 31.6, 31.95));

  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        {/* globe disc */}
        <circle cx={CENTER.x} cy={CENTER.y} r={v.scale} fill={C.deep} fillOpacity={globeK} stroke={C.muted} strokeOpacity={0.6 * globeK} strokeWidth={2} />
        <path d={dWorld} fill={C.muted} opacity={0.75} />
        <path d={dIndo} fill={C.line} />
        <path d={dFresh} fill={C.white} />

        {/* Indonesia arcs */}
        {INDO.map((c, i) => {
          const a = INDO_T0 + i * INDO_STEP;
          if (t < a) return null;
          const k = p(t, a, a + 0.45, EASE);
          const { d, head } = arcPath(v, JAKARTA, c.at, k);
          const end = proj(c.at);
          const arrived = k >= 1 && end && visible(v, c.at);
          const pop = p(t, a + 0.45, a + 0.6);
          const fade = 1 - 0.5 * p(t, a + 0.8, a + 1.4) - 0.5 * zoomOut;
          return (
            <g key={c.name} opacity={fade}>
              <path d={d} fill="none" stroke={C.red} strokeWidth={4} strokeLinecap="round" />
              {head && k < 1 ? <circle cx={head[0]} cy={head[1]} r={6} fill={C.white} /> : null}
              {arrived ? <circle cx={end[0]} cy={end[1]} r={7 * pop} fill={C.white} stroke={C.red} strokeWidth={3} /> : null}
            </g>
          );
        })}

        {/* world arcs */}
        {WORLD.map((c, i) => {
          const a = WORLD_T0 + i * WORLD_STEP;
          if (t < a) return null;
          const k = p(t, a, a + 0.6, EASE);
          const { d, head } = arcPath(v, JAKARTA, c.at, k);
          const end = proj(c.at);
          const arrived = k >= 1 && end && visible(v, c.at);
          return (
            <g key={c.name}>
              <path d={d} fill="none" stroke={C.red} strokeWidth={3.5} strokeLinecap="round" />
              {head && k < 1 ? <circle cx={head[0]} cy={head[1]} r={5} fill={C.white} /> : null}
              {arrived ? <circle cx={end[0]} cy={end[1]} r={6} fill={C.white} /> : null}
            </g>
          );
        })}

        {/* Jakarta */}
        {visible(v, JAKARTA) ? (
          <g>
            {[0, 1, 2].map((n) => {
              const ph = ((t - 20.2 + n * 0.33) % 1 + 1) % 1;
              return t > 20.2 ? <circle key={n} cx={jk[0]} cy={jk[1]} r={10 + ph * 46} fill="none" stroke={C.red} strokeWidth={3} opacity={(1 - ph) * 0.8} /> : null;
            })}
            <circle cx={jk[0]} cy={jk[1]} r={12} fill={C.red} stroke={C.white} strokeWidth={4} />
          </g>
        ) : null}
      </svg>

      {/* labels */}
      {[...INDO.map((c, i) => ({ ...c, a: INDO_T0 + i * INDO_STEP + 0.45, world: false })), ...WORLD.map((c, i) => ({ ...c, a: WORLD_T0 + i * WORLD_STEP + 0.5, world: true }))].map((c) => {
        if (t < c.a || !visible(v, c.at)) return null;
        const pt = proj(c.at);
        if (!pt) return null;
        const o = p(t, c.a, c.a + 0.2) * (c.world ? 1 - p(t, 31.25, 31.45) : 1 - zoomOut);
        return (
          <div key={c.name} style={{ position: "absolute", left: pt[0] + (LABEL_OFF[c.name]?.[0] ?? 12), top: pt[1] + (LABEL_OFF[c.name]?.[1] ?? -34), fontSize: 22, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.85)", opacity: o, whiteSpace: "nowrap" }}>
            {c.name}
          </div>
        );
      })}
      {visible(v, JAKARTA) && t > 20.2 ? (
        <div style={{ position: "absolute", left: jk[0] + 22, top: jk[1] + 10, fontSize: 26, fontWeight: 800, letterSpacing: "0.12em", color: C.white, opacity: p(t, 20.2, 20.5) * (1 - p(t, 31.2, 31.4)) }}>
          JAKARTA
        </div>
      ) : null}

      {/* copy: domestic first, then the international leg */}
      {[
        { words: LINE, tin: 20.6, tout: 24.55 },
        { words: INTL, tin: 24.95, tout: 30.9 },
      ].map((blk, bi) => {
        const kin = p(t, blk.tin, blk.tin + 0.5);
        const kout = p(t, blk.tout, blk.tout + 0.4, EASE_IN);
        if (t < blk.tin || t > blk.tout + 0.45) return null;
        return (
          <div key={bi} style={{ position: "absolute", left: 80, top: 1360, width: 920, opacity: kin * (1 - kout), translate: `0px ${mix(30, 0, kin) - kout * 30}px` }}>
            {bi === 1 ? (
              <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "0.16em", color: "rgba(255,255,255,0.6)", marginBottom: 14 }}>INTERNATIONAL FREIGHT FORWARDING</div>
            ) : null}
            <div style={{ fontSize: 54, fontWeight: 700, letterSpacing: "-0.035em", lineHeight: 1.08, color: C.white }}>
              {blk.words.map((w, i) => {
                const k = p(t, blk.tin + i * 0.06, blk.tin + 0.4 + i * 0.06);
                return (
                  <span key={i} style={{ display: "inline-block", marginRight: "0.24em", opacity: k, translate: `0px ${mix(24, 0, k)}px` }}>
                    {w}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
      <div style={{ position: "absolute", left: 80, top: 1640, width: 920, fontSize: 25, fontWeight: 500, color: "rgba(255,255,255,0.55)", opacity: textIn * (1 - textOut) }}>
        Available lanes and service partners are confirmed during inquiry.
      </div>
    </AbsoluteFill>
  );
};
