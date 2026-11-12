import React from "react";
import { AbsoluteFill, Img, interpolateColors, staticFile } from "remotion";
import { Label } from "../components";
import { BACK, C, EASE, EASE_IN, EASE_INOUT, mix, p, shake, useT, WIN } from "../lib";

// ---------------------------------------------------------------- the morphing window
type Shape = { w: number; h: number; r: number; cy: number };
const SH: Shape[] = [
  { w: 44, h: 44, r: 22, cy: WIN.cy }, // red dot (end of the brief)
  { w: 760, h: 760, r: 380, cy: WIN.cy }, // 1 freight: circle
  { w: 620, h: 820, r: 16, cy: WIN.cy }, // 2 customs: document
  { w: 800, h: 800, r: 28, cy: WIN.cy }, // 3 warehouse: square
  { w: 920, h: 520, r: 260, cy: WIN.cy }, // 4 distribution: pill
  { w: 920, h: 680, r: 28, cy: WIN.cy }, // 5 project: wide
  { w: 920, h: 980, r: 16, cy: 880 }, // 6 the plan sheet
];
const T = [24, 28, 32, 36, 40, 44];
const MORPH: [number, number, (n: number) => number][] = [
  [24.0, 24.38, BACK],
  [27.7, 28.1, EASE_INOUT],
  [31.7, 32.1, EASE_INOUT],
  [35.7, 36.1, EASE_INOUT],
  [39.7, 40.1, EASE_INOUT],
  [43.85, 44.3, EASE_INOUT],
];

const windowAt = (t: number): Shape => {
  let s = SH[0];
  for (let i = 0; i < MORPH.length; i++) {
    const [a, b, e] = MORPH[i];
    const k = p(t, a, b, e);
    if (t < a) break;
    const A = SH[i];
    const B = SH[i + 1];
    s = { w: mix(A.w, B.w, k), h: mix(A.h, B.h, k), r: mix(A.r, B.r, k), cy: mix(A.cy, B.cy, k) };
  }
  return s;
};

/** sheet geometry (shared with the closing scene for the ink takeover) */
export const SHEET = { left: 80, top: 880 - 490, width: 920, height: 980 };
const ROW_Y = (i: number) => 400 + i * 170;
const BOX = 84;
export const LAST_CHECK = { x: SHEET.left + SHEET.width - 52 - BOX / 2, y: SHEET.top + ROW_Y(2) + BOX / 2 - 6 };

// ---------------------------------------------------------------- services copy (site.json, verbatim)
const SERVICES = [
  { name: "International Freight Forwarding", strap: "Air and ocean freight, with the handovers connected." },
  { name: "Customs Brokerage", strap: "Prepare the declaration around the actual commodity." },
  { name: "3PL & Warehousing", strap: "Storage, handling and fulfilment as one operating flow." },
  { name: "Domestic Distribution", strap: "Mode, capacity and access planned together." },
  { name: "Project Cargo", strap: "Heavy and oversized movements, planned against the real constraints." },
];

const THREAD = "M 1150 120 C 880 300 700 520 540 860 S 170 1170 -80 1280";
const THREAD_LEN = 1900;

// ---------------------------------------------------------------- station content inside the window
const Station: React.FC<{ i: number; t: number }> = ({ i, t }) => {
  const a = T[i];
  const b = T[i + 1];
  const vin = p(t, a - 0.18, a + 0.22, EASE);
  const vout = i === 4 ? p(t, 43.7, 43.95, EASE_IN) : p(t, b - 0.32, b - 0.04, EASE_IN);
  if (t < a - 0.2 || t > b + 0.05) return null;
  const local = t - a;
  const common: React.CSSProperties = {
    position: "absolute",
    left: "50%",
    top: "50%",
    opacity: vin * (1 - vout),
  };
  if (i === 0) {
    const sz = 690;
    return (
      <Img
        src={staticFile("img/freight.webp")}
        style={{
          ...common,
          width: sz,
          height: sz,
          marginLeft: -sz / 2,
          marginTop: -sz / 2 + 10,
          scale: `${mix(1.25, 1, vin) * (1 - vout * 0.12)}`,
          rotate: `${Math.sin(local * 2.2) * 1.6}deg`,
        }}
      />
    );
  }
  if (i === 1) {
    const sz = 600;
    return (
      <Img
        src={staticFile("img/customs.webp")}
        style={{ ...common, width: sz, height: sz, marginLeft: -sz / 2, marginTop: -sz / 2 - 20, scale: `${mix(1.2, 1, vin) * (1 - vout * 0.12)}` }}
      />
    );
  }
  if (i === 2) {
    const sz = 780;
    const glow = p(t, 32.55, 32.9) * (1 - p(t, 33.2, 34.2)) * 0.5 + p(t, 33.2, 34.2) * 0.15;
    return (
      <>
        <Img
          src={staticFile("img/warehouse.webp")}
          style={{ ...common, width: sz, height: sz, marginLeft: -sz / 2, marginTop: -sz / 2, scale: `${mix(1.2, 1, vin) * mix(1, 1.12, p(t, 32, 36, (x) => x))}` }}
        />
        <div
          style={{
            ...common,
            width: 520,
            height: 360,
            marginLeft: -260,
            marginTop: -40,
            borderRadius: "50%",
            background: "radial-gradient(closest-side, rgba(255,214,140,0.95), rgba(255,214,140,0))",
            mixBlendMode: "screen",
            opacity: glow * (1 - vout),
          }}
        />
      </>
    );
  }
  if (i === 3) {
    const sz = 780;
    const drive = p(t, 35.85, 36.4, EASE);
    const dash = (t * 900) % 120;
    return (
      <>
        <div
          style={{
            ...common,
            width: 1000,
            height: 6,
            marginLeft: -500,
            marginTop: 196,
            backgroundImage: `repeating-linear-gradient(90deg, ${C.line} 0 60px, transparent 60px 120px)`,
            backgroundPositionX: -dash,
          }}
        />
        <Img
          src={staticFile("img/truck.webp")}
          style={{
            ...common,
            width: sz,
            height: sz,
            marginLeft: -sz / 2,
            marginTop: -sz / 2 + 10,
            translate: `${mix(-900, 0, drive)}px 0px`,
            filter: `blur(${(1 - drive) * 10}px)`,
            opacity: 1 - vout,
          }}
        />
      </>
    );
  }
  // i === 4 project cargo
  const w = 900;
  const h = 600;
  const rise = p(t, 39.9, 40.6, EASE);
  return (
    <Img
      src={staticFile("img/heavy.webp")}
      style={{ ...common, width: w, height: h, marginLeft: -w / 2, marginTop: -h / 2 + 10, translate: `0px ${mix(70, 0, rise)}px`, scale: `${mix(1.15, 1, vin)}` }}
    />
  );
};

// ---------------------------------------------------------------- scene
export const Story: React.FC = () => {
  const t = useT();
  if (t < 23.95 || t > 50.3) return null;
  const s = windowAt(t);
  const bg = interpolateColors(p(t, 24.0, 24.12), [0, 1], [C.red, C.white]);
  const impacts = [24, 28, 32, 36, 40, 46, 47, 48];
  const sh = impacts.reduce(
    (acc, b) => {
      const v = shake(t, b, b === 24 ? 16 : 9, 0.32);
      return { x: acc.x + v.x, y: acc.y + v.y };
    },
    { x: 0, y: 0 },
  );
  const left = WIN.cx - s.w / 2;
  const top = s.cy - s.h / 2;

  // thread behind the window
  const draw = p(t, 24.05, 24.65, EASE);
  const retract = p(t, 43.65, 44.05, EASE_IN);
  const pulses = [24.1, 27.7, 31.7, 35.7, 39.7].map((a) => p(t, a, a + 0.6, EASE_INOUT));

  // shockwave at the drop
  const wave = p(t, 24.0, 24.7, EASE);

  return (
    <AbsoluteFill style={{ translate: `${sh.x}px ${sh.y}px` }}>
      {t >= 24 && t < 44.1 ? (
        <svg width={1080} height={1920} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
          <path
            d={THREAD}
            fill="none"
            stroke={C.red}
            strokeWidth={7}
            strokeLinecap="round"
            strokeDasharray={`${THREAD_LEN * draw * (1 - retract)} ${THREAD_LEN * 2}`}
            strokeDashoffset={-THREAD_LEN * retract}
          />
          {pulses.map((k, i) =>
            k > 0 && k < 1 ? (
              <path
                key={i}
                d={THREAD}
                fill="none"
                stroke={C.red}
                strokeWidth={20}
                strokeLinecap="round"
                strokeDasharray={`150 ${THREAD_LEN * 2}`}
                strokeDashoffset={-(THREAD_LEN + 150) * k + 150}
              />
            ) : null,
          )}
        </svg>
      ) : null}

      {t >= 24 && t < 24.7 ? (
        <div
          style={{
            position: "absolute",
            left: WIN.cx - 900 * wave,
            top: WIN.cy - 900 * wave,
            width: 1800 * wave,
            height: 1800 * wave,
            borderRadius: "50%",
            border: `${mix(18, 2, wave)}px solid ${C.red}`,
            opacity: 1 - wave,
          }}
        />
      ) : null}

      {/* window */}
      <div
        style={{
          position: "absolute",
          left,
          top,
          width: s.w,
          height: s.h,
          borderRadius: s.r,
          background: bg,
          border: `2px solid rgba(220,224,225,${p(t, 24.05, 24.2)})`,
          boxShadow: `0 40px 100px rgba(16,23,32,${0.08 * p(t, 24.05, 24.3)})`,
          overflow: "hidden",
        }}
      >
        {t >= 23.95 && t < 24.1 ? null : [0, 1, 2, 3, 4].map((i) => <Station key={i} i={i} t={t} />)}
        <SheetContent t={t} w={s.w} h={s.h} />
      </div>

      {/* customs stamp: a red check lands on the document */}
      {t > 28.85 && t < 31.75 ? (
        (() => {
          const k = p(t, 28.88, 29.0, EASE_IN);
          const o = 1 - p(t, 31.4, 31.7);
          return (
            <div
              style={{
                position: "absolute",
                left: WIN.cx + 230 - 66,
                top: WIN.cy - 410 + 40 - 66,
                width: 132,
                height: 132,
                borderRadius: "50%",
                background: C.red,
                opacity: k * o,
                scale: `${mix(2.2, 1, k)}`,
                rotate: `${mix(-25, 0, k)}deg`,
              }}
            >
              <svg viewBox="0 0 132 132" width={132} height={132}>
                <path d="M38 68 L58 88 L96 46" fill="none" stroke={C.white} strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          );
        })()
      ) : null}

      {/* project cargo: the thread wraps the load as a lifting sling */}
      {t > 40.8 && t < 43.95 ? (
        <svg width={1080} height={1920} style={{ position: "absolute", inset: 0, overflow: "visible", opacity: 1 - p(t, 43.6, 43.9) }}>
          {[
            "M 600 812 L 690 640 L 790 812",
            "M 590 812 C 640 800 750 800 800 812",
          ].map((d, i) => {
            const k = p(t, 40.95 + i * 0.25, 41.45 + i * 0.25, EASE);
            return <path key={i} d={d} fill="none" stroke={C.red} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={`${k} 2`} />;
          })}
        </svg>
      ) : null}

      {/* station copy */}
      {SERVICES.map((sv, i) => {
        const a = T[i];
        const b = T[i + 1];
        const kin = p(t, a + 0.05, a + 0.5, EASE);
        const kout = p(t, b - 0.35, b - 0.05, EASE_IN);
        if (t < a || t > b) return null;
        return (
          <div key={sv.name} style={{ position: "absolute", left: 80, top: 1318, width: 920, opacity: kin * (1 - kout), translate: `0px ${mix(40, 0, kin) - kout * 24}px` }}>
            <Label style={{ fontSize: 28 }}>
              <span style={{ color: C.red }}>{String(i + 1).padStart(2, "0")}</span> / 05
            </Label>
            <div style={{ marginTop: 14, fontSize: 62, fontWeight: 700, letterSpacing: "-0.035em", lineHeight: 1.04, color: C.ink }}>{sv.name}</div>
            <div style={{ marginTop: 16, fontSize: 38, fontWeight: 500, lineHeight: 1.3, color: C.muted, letterSpacing: "-0.01em" }}>{sv.strap}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- the plan sheet (44-50)
const PLAN = ["Scope", "Timelines", "Responsibility"];
const CHECK_T = [46, 47, 48];

const SheetContent: React.FC<{ t: number; w: number; h: number }> = ({ t, w, h }) => {
  if (t < 44.15) return null;
  const inK = p(t, 44.2, 44.6, EASE);
  const under = p(t, 44.45, 44.95, EASE);
  return (
    <div style={{ position: "absolute", left: (w - SHEET.width) / 2, top: (h - SHEET.height) / 2, width: SHEET.width, height: SHEET.height, opacity: inK }}>
      <Label style={{ position: "absolute", left: 52, top: 56 }}>Shipment plan</Label>
      <div style={{ position: "absolute", left: 52, top: 104, width: 816, fontSize: 62, fontWeight: 700, letterSpacing: "-0.035em", lineHeight: 1.06, color: C.ink, translate: `0px ${mix(30, 0, inK)}px` }}>
        Explicit before anything is committed.
      </div>
      <div style={{ position: "absolute", left: 52, top: 262, height: 6, borderRadius: 3, width: 260 * under, background: C.red }} />
      {PLAN.map((label, i) => {
        const rk = p(t, 44.5 + i * 0.12, 44.9 + i * 0.12, EASE);
        const ck = p(t, CHECK_T[i] - 0.1, CHECK_T[i], EASE_IN);
        return (
          <div key={label} style={{ position: "absolute", left: 52, top: ROW_Y(i), width: 816, height: 140, opacity: rk, translate: `${mix(-40, 0, rk)}px 0px` }}>
            <div style={{ position: "absolute", left: 0, top: 6, fontSize: 70, fontWeight: 700, letterSpacing: "-0.04em", color: C.ink }}>{label}</div>
            <div style={{ position: "absolute", right: 0, top: 0, width: BOX, height: BOX, borderRadius: 10, border: `4px solid ${C.ink}` }} />
            {t >= CHECK_T[i] - 0.1 ? (
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: 0,
                  width: BOX,
                  height: BOX,
                  borderRadius: 10,
                  background: C.red,
                  opacity: ck,
                  scale: `${mix(1.9, 1, ck)}`,
                  rotate: `${mix(-16, 0, ck)}deg`,
                }}
              >
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
  );
};

/** the plane sweeps across the frame on the drop (above everything) */
export const Plane: React.FC = () => {
  const t = useT();
  if (t < 24.3 || t > 25.4) return null;
  const k = p(t, 24.32, 25.35, (x) => x);
  const e = EASE_INOUT(k);
  const sz = mix(380, 640, e);
  const x = mix(-520, 1180, e);
  const y = mix(1540, 60, e);
  return (
    <Img
      src={staticFile("img/plane.webp")}
      style={{
        position: "absolute",
        left: x - sz / 2,
        top: y - sz / 2,
        width: sz,
        height: sz,
        rotate: "-12deg",
        filter: `blur(${Math.abs(Math.sin(k * Math.PI)) * 3}px)`,
      }}
    />
  );
};
