import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { Label } from "../components";
import { BACK, C, EASE, EASE_IN, EASE_INOUT, mix, p, shake, useT } from "../lib";

// ---------------------------------------------------------------- copy (site.json, verbatim) and look
const SERVICES = [
  { name: "International Freight Forwarding", strap: "Air and ocean freight, with the handovers connected.", chips: ["Air", "Ocean", "FCL / LCL"], word: "AIR + OCEAN", img: "freight.webp", bg: C.paper },
  { name: "Customs Brokerage", strap: "Prepare the declaration around the actual commodity.", chips: ["HS review", "Documents", "Permits"], word: "CUSTOMS", img: "customs.webp", bg: C.white },
  { name: "3PL & Warehousing", strap: "Storage, handling and fulfilment as one operating flow.", chips: ["Receiving", "Pick & pack", "Dispatch"], word: "WAREHOUSING", img: "warehouse.webp", bg: C.tint },
  { name: "Domestic Distribution", strap: "Mode, capacity and access planned together.", chips: ["FTL", "LTL", "Domestic air"], word: "DOMESTIC", img: "truck.webp", bg: C.white },
  { name: "Project Cargo", strap: "Heavy and oversized movements, planned against the real constraints.", chips: ["OOG", "Heavy-lift", "Breakbulk"], word: "PROJECT CARGO", img: "heavy.webp", bg: C.paper },
];
export const STATION_T = [26, 30, 34, 38, 42];
/** scenes after the map run 2 s later than their authored times */
export const SHIFT = 2;
const CARD = { w: 640, h: 900, cy: 880 };

/** sheet geometry (shared with the closing scene) */
export const SHEET = { left: 80, top: 880 - 490, width: 920, height: 980 };
const ROW_Y = (i: number) => 400 + i * 170;
const BOX = 84;
export const LAST_CHECK = { x: SHEET.left + SHEET.width - 52 - BOX / 2, y: SHEET.top + ROW_Y(2) + BOX / 2 };
export const CHECK_T = [47, 47.5, 48];

/** continuous index of the card at the front */
const activeAt = (t: number) => STATION_T.slice(1).reduce((acc, T) => acc + p(t, T - 0.55, T + 0.05, EASE_INOUT), 0);

// ---------------------------------------------------------------- card faces
const Front: React.FC<{ i: number; t: number; active: boolean }> = ({ i, t, active }) => {
  const s = SERVICES[i];
  const T = STATION_T[i];
  const local = t - T;
  const float = Math.sin(t * 2.1 + i) * 8;
  let imgStyle: React.CSSProperties = { position: "absolute", left: (CARD.w - 700) / 2, top: -110, width: 700, height: 700, translate: `0px ${float}px` };
  if (i === 4) imgStyle = { position: "absolute", left: (CARD.w - 760) / 2, top: 20, width: 760, height: 507, translate: `0px ${mix(70, 0, p(t, 42.0, 42.6, EASE)) + float * 0.5}px` };
  if (i === 3) {
    const drive = p(t, 37.85, 38.45, EASE);
    imgStyle = { ...imgStyle, translate: `${mix(-900, 0, active ? drive : 1)}px ${float * 0.4}px`, filter: `blur(${active ? (1 - drive) * 10 : 0}px)` };
  }
  return (
    <>
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 44,
          background: s.bg,
          overflow: "hidden",
          boxShadow: "0 70px 140px rgba(0,0,0,0.5)",
        }}
      >
        {/* technical grid in the picture area */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: CARD.w,
            height: 560,
            backgroundImage: "linear-gradient(rgba(16,23,32,0.07) 2px, transparent 2px), linear-gradient(90deg, rgba(16,23,32,0.07) 2px, transparent 2px)",
            backgroundSize: "64px 64px",
            backgroundPosition: `${-t * 12}px 0px`,
            maskImage: "linear-gradient(180deg, black 30%, transparent 100%)",
            WebkitMaskImage: "linear-gradient(180deg, black 30%, transparent 100%)",
          }}
        />
        {i === 2 ? (
          <div
            style={{
              position: "absolute",
              left: 60,
              top: 140,
              width: 520,
              height: 380,
              borderRadius: "50%",
              background: "radial-gradient(closest-side, rgba(255,210,130,0.9), rgba(255,210,130,0))",
              mixBlendMode: "multiply",
              opacity: active ? p(t, 34.5, 34.9) * (1 - p(t, 35.2, 36.4)) * 0.6 + 0.12 : 0.12,
            }}
          />
        ) : null}
        <div style={{ position: "absolute", left: 52, top: 590, width: CARD.w - 104 }}>
          <div style={{ fontSize: 52, fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1.02, color: C.ink }}>{s.name}</div>
          <div style={{ marginTop: 16, fontSize: 29, fontWeight: 500, lineHeight: 1.32, color: C.muted }}>{s.strap}</div>
        </div>
        <div style={{ position: "absolute", left: 52, bottom: 44, display: "flex", gap: 12 }}>
          {s.chips.map((c, k) => (
            <div
              key={c}
              style={{
                padding: "8px 18px",
                borderRadius: 999,
                border: `2px solid rgba(16,23,32,0.18)`,
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "0.04em",
                color: C.ink,
                opacity: active ? p(t, T + 0.35 + k * 0.08, T + 0.6 + k * 0.08) : 1,
              }}
            >
              {c}
            </div>
          ))}
        </div>
      </div>
      {/* the object breaks out of the card */}
      <Img src={staticFile(`img/${s.img}`)} style={imgStyle} />
      {i === 1 && t > 30.9 ? (
        <div
          style={{
            position: "absolute",
            right: 34,
            top: 34,
            width: 120,
            height: 120,
            borderRadius: "50%",
            background: C.red,
            opacity: p(t, 30.9, 31.0, EASE_IN),
            scale: `${mix(2.3, 1, p(t, 30.9, 31.0, EASE_IN))}`,
            rotate: `${mix(-30, 0, p(t, 30.9, 31.0, EASE_IN))}deg`,
          }}
        >
          <svg viewBox="0 0 120 120" width={120} height={120}>
            <path d="M34 62 L53 81 L88 42" fill="none" stroke={C.white} strokeWidth={11} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      ) : null}
      {i === 4 && t > 42.9 ? (
        <svg width={CARD.w} height={600} style={{ position: "absolute", left: 0, top: 20, overflow: "visible" }}>
          {["M 300 300 L 420 70 L 560 300", "M 290 300 C 360 285 500 285 570 300"].map((d, k) => (
            <path key={k} d={d} fill="none" stroke={C.red} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={`${p(t, 42.95 + k * 0.25, 43.45 + k * 0.25, EASE)} 2`} />
          ))}
        </svg>
      ) : null}
      {void local}
    </>
  );
};

// ---------------------------------------------------------------- the plan sheet (back of the last card)
const PLAN = ["Scope", "Timelines", "Responsibility"];

const SheetContent: React.FC<{ t: number }> = ({ t }) => {
  const inK = p(t, 46.15, 46.55, EASE);
  const under = p(t, 46.4, 46.9, EASE);
  return (
    <div style={{ position: "absolute", inset: 0, borderRadius: 28, background: C.white, boxShadow: "0 70px 140px rgba(0,0,0,0.5)", overflow: "hidden" }}>
      <div style={{ opacity: inK }}>
        <Label style={{ position: "absolute", left: 52, top: 56 }}>Shipment plan</Label>
        <div style={{ position: "absolute", left: 52, top: 104, width: 816, fontSize: 62, fontWeight: 700, letterSpacing: "-0.035em", lineHeight: 1.06, color: C.ink, translate: `0px ${mix(30, 0, inK)}px` }}>
          Explicit before anything is committed.
        </div>
        <div style={{ position: "absolute", left: 52, top: 262, height: 6, borderRadius: 3, width: 260 * under, background: C.red }} />
        {PLAN.map((label, i) => {
          const rk = p(t, 46.45 + i * 0.12, 46.85 + i * 0.12, EASE);
          const ck = p(t, CHECK_T[i] - 0.1, CHECK_T[i], EASE_IN);
          return (
            <div key={label} style={{ position: "absolute", left: 52, top: ROW_Y(i), width: 816, height: 140, opacity: rk, translate: `${mix(-40, 0, rk)}px 0px` }}>
              <div style={{ position: "absolute", left: 0, top: 6, fontSize: 70, fontWeight: 700, letterSpacing: "-0.04em", color: C.ink }}>{label}</div>
              <div style={{ position: "absolute", right: 0, top: 0, width: BOX, height: BOX, borderRadius: 10, border: `4px solid ${C.ink}` }} />
              {t >= CHECK_T[i] - 0.1 ? (
                <div style={{ position: "absolute", right: 0, top: 0, width: BOX, height: BOX, borderRadius: 10, background: C.red, opacity: ck, scale: `${mix(1.9, 1, ck)}`, rotate: `${mix(-16, 0, ck)}deg` }}>
                  <svg viewBox="0 0 84 84" width={84} height={84}>
                    <path d="M22 44 L37 59 L64 28" fill="none" stroke={C.white} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              ) : null}
              <div style={{ position: "absolute", left: 0, top: 128, width: "100%", height: 2, background: C.line }} />
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- scene
export const Services: React.FC = () => {
  const t = useT() - SHIFT;
  if (t < 25.95 || t > 50.0) return null;
  const a = activeAt(t);
  const front = Math.round(a);
  const sh = [26, 30, 34, 38, 42, 47, 47.5, 48].reduce(
    (acc, b) => {
      const v = shake(t, b, b === 26 ? 16 : 8, 0.3);
      return { x: acc.x + v.x, y: acc.y + v.y };
    },
    { x: 0, y: 0 },
  );
  const exit = p(t, 45.55, 46.15, EASE_IN);
  const flip = p(t, 45.7, 46.3, EASE_INOUT);
  const leave = p(t, 49.4, 49.85, EASE_IN);

  // marquee keyword behind the ring
  const wordIdx = Math.min(4, Math.max(0, Math.round(a)));
  const wordFade = 1 - Math.abs(a - Math.round(a)) * 2;

  const cards = SERVICES.map((_, i) => {
    let rel = i - a;
    if (rel > 2.5) rel -= 5;
    if (rel < -2.5) rel += 5;
    // rounded showcase: neighbours swing in at the sides, the rest stack behind
    const ar = Math.abs(rel);
    const sg = Math.sign(rel);
    const near = Math.min(ar, 1);
    const far = Math.max(ar - 1, 0);
    const fly = p(t, 26.0 + i * 0.07, 26.6 + i * 0.07, BACK);
    let x = sg * (near * 560 + far * 210) * fly;
    let z = -(near * 400 + far * 280) * fly;
    let y = (near * 36 + far * 20) * fly - Math.sin(Math.min(ar, 1) * Math.PI) * 50 * (ar < 1 ? 1 : 0);
    let rotY = -sg * near * 40 * fly;
    const spin = (1 - fly) * 220;
    let scale = mix(0.05, 1, fly);
    let opacity = ar < 2.3 ? 1 : 0;
    // velocity tilt while the ring turns
    const turning = STATION_T.slice(1).some((T) => t > T - 0.55 && t < T + 0.05);
    const tilt = turning ? -8 : 0;
    if (i !== 4) {
      x *= 1 + exit * 2.4;
      z -= 900 * exit;
      y -= 300 * exit;
      opacity *= 1 - exit;
    }
    const isLast = i === 4;
    const w = isLast ? mix(CARD.w, SHEET.width, flip) : CARD.w;
    const h = isLast ? mix(CARD.h, SHEET.height, flip) : CARD.h;
    if (isLast && flip > 0) rotY = 180 * flip;
    if (isLast) {
      scale *= 1 - leave * 0.25;
      opacity *= 1 - leave;
    }
    const dim = Math.min(0.62, ar * 0.42);
    return { i, x, y, z, rotY, rotZ: spin + tilt * 0, scale, opacity, w, h, dim, depth: -ar };
  });
  const order = [...cards].sort((u, v) => u.depth - v.depth);

  const orbitA = t * 1.7;
  const ox = 540 + Math.cos(orbitA) * 560;
  const oy = 1405 + Math.sin(orbitA) * 92;
  const stageIn = p(t, 26.0, 26.5);

  return (
    <AbsoluteFill style={{ translate: `${sh.x}px ${sh.y}px` }}>
      {/* keyword marquee */}
      <div style={{ position: "absolute", top: 300, left: 0, width: 1080, overflow: "hidden", opacity: stageIn * (1 - exit) * Math.max(0, wordFade) }}>
        <div
          style={{
            whiteSpace: "nowrap",
            fontSize: 250,
            fontWeight: 800,
            letterSpacing: "-0.04em",
            color: "transparent",
            WebkitTextStroke: "2px rgba(255,255,255,0.13)",
            translate: `${-((t * 140) % 1600)}px 0px`,
          }}
        >
          {`${SERVICES[wordIdx].word} · ${SERVICES[wordIdx].word} · ${SERVICES[wordIdx].word} ·`}
        </div>
      </div>

      {/* orbit: the thread now circles the ring, a shipment dot riding it */}
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0, opacity: stageIn * (1 - exit) }}>
        <ellipse cx={540} cy={1405} rx={560} ry={92} fill="none" stroke={C.red} strokeWidth={4} opacity={0.9} />
        <ellipse cx={540} cy={1405} rx={420} ry={64} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={2} />
        <circle cx={ox} cy={oy} r={11} fill={C.white} stroke={C.red} strokeWidth={4} />
      </svg>

      {/* ring of cards */}
      <div style={{ position: "absolute", inset: 0, perspective: 2200, perspectiveOrigin: `540px ${CARD.cy}px` }}>
        {order.map((c) => {
          const isLast = c.i === 4;
          return (
            <div
              key={c.i}
              style={{
                position: "absolute",
                left: 540 - c.w / 2,
                top: CARD.cy - c.h / 2,
                width: c.w,
                height: c.h,
                transformStyle: "preserve-3d",
                transform: `translate3d(${c.x}px, ${c.y}px, ${c.z}px) rotateY(${c.rotY}deg) rotateZ(${c.rotZ}deg) scale(${c.scale})`,
                opacity: c.opacity,
              }}
            >
              <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}>
                <Front i={c.i} t={t} active={c.i === front} />
                <div style={{ position: "absolute", inset: 0, borderRadius: 44, background: C.ink, opacity: c.dim, pointerEvents: "none" }} />
              </div>
              {isLast ? (
                <div style={{ position: "absolute", inset: 0, transform: "rotateY(180deg)", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}>
                  <SheetContent t={t} />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/** the plane sweeps across the frame on the drop (above everything) */
export const Plane: React.FC = () => {
  const t = useT() - SHIFT;
  if (t < 26.25 || t > 27.4) return null;
  const k = p(t, 26.28, 27.35, (x) => x);
  const e = EASE_INOUT(k);
  const sz = mix(380, 680, e);
  const x = mix(-520, 1200, e);
  const y = mix(1560, 40, e);
  return (
    <Img
      src={staticFile("img/plane.webp")}
      style={{ position: "absolute", left: x - sz / 2, top: y - sz / 2, width: sz, height: sz, rotate: "-12deg", filter: `blur(${Math.abs(Math.sin(k * Math.PI)) * 3}px)` }}
    />
  );
};
