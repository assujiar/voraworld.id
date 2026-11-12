import React from "react";
import { AbsoluteFill, interpolateColors } from "remotion";
import { Label } from "../components";
import { C, EASE, EASE_IN, EASE_INOUT, mix, p, useT, WIN } from "../lib";
import { knotAt } from "./Intro";

const CARD = { left: 80, top: 400, width: 920, height: 960, pad: 52 };
const ROW0 = 700;
const ROW_H = 150;
const ROWS = [
  { label: "Cargo", value: "Machine parts, 6 pallets", start: 17.6, dur: 0.28 },
  { label: "From", value: "Jakarta, Indonesia", start: 18.6, dur: 0.39 },
  { label: "To", value: "Rotterdam, Netherlands", start: 19.6, dur: 0.5 },
  { label: "Arrive by", value: "Week 48", start: 20.6, dur: 0.33 },
];
const underlineY = (i: number) => ROW0 + i * ROW_H + 118;
const TITLE = "Tell us what is moving, where it has to go, and by when.".split(" ");

/** which row the red underline sits on (fractional while sliding) */
const activeRow = (t: number) =>
  ROWS.reduce((acc, r, i) => (i === 0 ? 0 : acc + p(t, r.start - 0.12, r.start + 0.14, EASE_INOUT)), 0);

export const Brief: React.FC = () => {
  const t = useT();
  if (t < 15.3 || t > 24.05) return null;

  // card in, then collapse into a red dot at the window centre
  const inK = p(t, 16.55, 17.0, EASE);
  const fade = p(t, 22.42, 22.62, EASE_IN);
  const m = p(t, 22.6, 23.3, EASE_INOUT);
  const dot = 44;
  const left = mix(CARD.left, WIN.cx - dot / 2, m);
  const top = mix(CARD.top, WIN.cy - dot / 2, m) + mix(80, 0, inK);
  const width = mix(CARD.width, dot, m);
  const height = mix(CARD.height, dot, m);
  const radius = mix(16, dot / 2, p(t, 22.75, 23.3));
  const bg = interpolateColors(p(t, 22.95, 23.25), [0, 1], [C.white, C.red]);
  const beat = t > 23.3 ? 1 + 0.18 * Math.max(0, Math.sin((t - 23.3) * Math.PI * 4)) * (1 - p(t, 23.75, 23.95)) : 1;

  // the thread: from the scarf knot (agent leaving) to the active underline
  const k = knotAt(t);
  const sx = k.x;
  const sy = Math.min(k.y, 1990);
  const row = activeRow(t);
  const ex = CARD.left + CARD.pad;
  const ey = underlineY(0) + row * ROW_H + mix(80, 0, inK);
  // routed around the card: down-left under it, up the left margin, then into the underline
  const d = `M ${sx} ${sy} C ${sx} ${Math.max(sy - 260, 1520)}, 40 ${1560}, 40 ${Math.max(ey + 160, 1300)} L 40 ${ey + 60} Q 40 ${ey}, ${ex} ${ey}`;
  const draw = p(t, 15.35, 16.95, EASE) * (1 - p(t, 22.25, 22.6, EASE_IN));
  const L = 2400;

  const tagK = p(t, 21.38, 21.5, EASE_IN);

  return (
    <AbsoluteFill>
      {/* card */}
      <div
        style={{
          position: "absolute",
          left,
          top,
          width,
          height,
          borderRadius: radius,
          background: bg,
          border: `2px solid ${C.line}`,
          borderColor: `rgba(220,224,225,${1 - p(t, 22.8, 23.1)})`,
          boxShadow: `0 40px 90px rgba(16,23,32,${0.07 * (1 - m)})`,
          opacity: inK,
          scale: `${beat}`,
          overflow: "hidden",
        }}
      >
        <div style={{ opacity: 1 - fade, position: "absolute", left: 0, top: 0, width: CARD.width, height: CARD.height }}>
          <div
            style={{
              position: "absolute",
              left: CARD.pad,
              top: 50,
              width: CARD.width - CARD.pad * 2,
              fontSize: 56,
              fontWeight: 600,
              letterSpacing: "-0.03em",
              lineHeight: 1.1,
              color: C.ink,
            }}
          >
            {TITLE.map((w, i) => {
              const wk = p(t, 16.9 + i * 0.05, 17.3 + i * 0.05);
              return (
                <span key={i} style={{ display: "inline-block", marginRight: "0.25em", opacity: wk, translate: `0px ${mix(28, 0, wk)}px` }}>
                  {w}
                </span>
              );
            })}
          </div>
          {ROWS.map((r, i) => {
            const y = ROW0 - CARD.top + i * ROW_H;
            const n = Math.round(r.value.length * p(t, r.start, r.start + r.dur, (x) => x));
            const typing = t >= r.start && t < r.start + r.dur + 0.5;
            const caretOn = typing && Math.floor(t * 4) % 2 === 0;
            return (
              <div key={r.label} style={{ position: "absolute", left: CARD.pad, top: y, width: CARD.width - CARD.pad * 2 }}>
                <Label style={{ fontSize: 26 }}>{r.label}</Label>
                <div style={{ marginTop: 10, fontSize: 52, fontWeight: 600, letterSpacing: "-0.025em", color: C.ink, height: 62 }}>
                  {r.value.slice(0, n)}
                  <span style={{ display: "inline-block", width: 4, height: 50, marginLeft: 4, background: C.ink, opacity: caretOn ? 1 : 0, translate: "0px 6px" }} />
                </div>
                <div style={{ position: "absolute", left: 0, top: 118, width: "100%", height: 2, background: C.line }} />
              </div>
            );
          })}
        </div>
      </div>

      {/* red underline that rides row to row (the end of the thread) */}
      {t > 16.6 && t < 22.62 ? (
        <div
          style={{
            position: "absolute",
            left: ex,
            top: ey - 2,
            height: 5,
            width: (CARD.width - CARD.pad * 2) * p(t, 16.75, 17.25, EASE) * (1 - fade),
            background: C.red,
            borderRadius: 3,
          }}
        />
      ) : null}

      {/* the thread */}
      {draw > 0.001 ? (
        <svg width={1080} height={1920} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
          <path d={d} fill="none" stroke={C.red} strokeWidth={6} strokeLinecap="round" strokeDasharray={`${L * draw} ${L}`} />
        </svg>
      ) : null}

      {/* "sample brief" stamp */}
      {t > 21.38 && t < 22.6 ? (
        <div
          style={{
            position: "absolute",
            right: 80,
            top: 322,
            padding: "10px 18px",
            border: `3px solid ${C.ink}`,
            borderRadius: 8,
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: "0.14em",
            color: C.ink,
            opacity: tagK * (1 - fade),
            scale: `${mix(1.9, 1, tagK)}`,
            rotate: `${mix(-14, -4, tagK)}deg`,
            background: C.paper,
          }}
        >
          SAMPLE BRIEF
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

