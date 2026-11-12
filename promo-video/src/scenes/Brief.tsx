import React from "react";
import { AbsoluteFill, interpolateColors } from "remotion";
import { Label } from "../components";
import { C, EASE, EASE_IN, EASE_INOUT, mix, p, useT } from "../lib";
import { knotAt } from "./Intro";
import { jakartaAt } from "../map";

const CARD = { left: 80, top: 400, width: 920, height: 960, pad: 52 };
const ROW0 = 700;
const ROW_H = 150;
const ROWS = [
  { label: "Cargo", value: "Machine parts, 6 pallets", start: 16.3, dur: 0.25 },
  { label: "From", value: "Jakarta, Indonesia", start: 17.0, dur: 0.35 },
  { label: "To", value: "Rotterdam, Netherlands", start: 17.7, dur: 0.45 },
  { label: "Arrive by", value: "Week 48", start: 18.4, dur: 0.3 },
];
const underlineY = (i: number) => ROW0 + i * ROW_H + 118;
const TITLE = "Tell us what is moving, where it has to go, and by when.".split(" ");

/** which row the red underline sits on (fractional while sliding) */
const activeRow = (t: number) =>
  ROWS.reduce((acc, r, i) => (i === 0 ? 0 : acc + p(t, r.start - 0.12, r.start + 0.14, EASE_INOUT)), 0);

export const Brief: React.FC = () => {
  const t = useT();
  if (t < 14.3 || t > 20.1) return null;

  // card in, then collapse into a red dot at the window centre
  const inK = p(t, 15.5, 15.95, EASE);
  const fade = p(t, 19.38, 19.55, EASE_IN);
  const m = p(t, 19.5, 19.95, EASE_INOUT);
  const jk = jakartaAt(19.95);
  const dot = 24;
  const left = mix(CARD.left, jk.x - dot / 2, m);
  const top = mix(CARD.top, jk.y - dot / 2, m) + mix(80, 0, inK);
  const width = mix(CARD.width, dot, m);
  const height = mix(CARD.height, dot, m);
  const radius = mix(16, dot / 2, p(t, 19.6, 19.95));
  const bg = interpolateColors(p(t, 19.75, 19.92), [0, 1], [C.white, C.red]);
  const beat = 1;

  // the thread: from the scarf knot (agent leaving) to the active underline
  const k = knotAt(t);
  const sx = k.x;
  const sy = Math.min(k.y, 1990);
  const row = activeRow(t);
  const ex = CARD.left + CARD.pad;
  const ey = underlineY(0) + row * ROW_H + mix(80, 0, inK);
  // routed around the card: down-left under it, up the left margin, then into the underline
  const d = `M ${sx} ${sy} C ${sx} ${Math.max(sy - 260, 1520)}, 40 ${1560}, 40 ${Math.max(ey + 160, 1300)} L 40 ${ey + 60} Q 40 ${ey}, ${ex} ${ey}`;
  const draw = p(t, 14.35, 15.95, EASE) * (1 - p(t, 19.2, 19.5, EASE_IN));
  const L = 2400;

  const tagK = p(t, 18.88, 19.0, EASE_IN);

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
          borderColor: `rgba(220,224,225,${1 - p(t, 19.6, 19.85)})`,
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
              const wk = p(t, 15.85 + i * 0.05, 16.25 + i * 0.05);
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
      {t > 15.6 && t < 19.55 ? (
        <div
          style={{
            position: "absolute",
            left: ex,
            top: ey - 2,
            height: 5,
            width: (CARD.width - CARD.pad * 2) * p(t, 15.7, 16.2, EASE) * (1 - fade),
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
      {t > 18.88 && t < 19.55 ? (
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

