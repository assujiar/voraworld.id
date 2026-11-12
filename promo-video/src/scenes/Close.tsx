import React from "react";
import { AbsoluteFill } from "remotion";
import { getLength, getPointAtLength } from "@remotion/paths";
import { Agent, Logo, redGrow } from "../components";
import { BACK, C, EASE, EASE_IN, EASE_INOUT, mix, p, shake, useT } from "../lib";
import { LAST_CHECK } from "./Story";

const LOGO = { left: 100, width: 880 };
const LOGO_H = (LOGO.width * 384) / 1780;
const LOGO_TOP = 880 - LOGO_H / 2;
const sc = LOGO.width / 1780;
// counterform base centre on the page
const A_BASE = { x: LOGO.left + (1584 - 132) * sc, y: LOGO_TOP + (505 - 164) * sc };
const A_CENTER = { x: LOGO.left + (1584 - 132) * sc, y: LOGO_TOP + (450 - 164) * sc };

// the stitch: a needle path zig-zagging across the wordmark, ending in the base of the A
const PTS: [number, number][] = [
  [30, 846],
  [175, 975],
  [320, 785],
  [465, 975],
  [610, 785],
  [755, 975],
  [900, 785],
  [1015, 900],
  [A_BASE.x, A_BASE.y],
];
const STITCH = "M " + PTS.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L ");
const LEN = getLength(STITCH);

const TAG = "Bringing the World Within Reach.".split(" ");

export const Close: React.FC = () => {
  const t = useT();
  if (t < 49.45) return null;

  // ink takeover from the last check
  const ink = p(t, 49.5, 50.1, EASE_IN);
  const R = 2400 * ink;

  // needle progress and reveal
  const prog = p(t, 50.6, 53.2, Easing2);
  const tip = getPointAtLength(STITCH, LEN * prog) ?? { x: 0, y: 0 };
  let maxX = 0;
  for (let i = 0; i <= 40; i++) {
    const q = getPointAtLength(STITCH, LEN * prog * (i / 40));
    maxX = Math.max(maxX, q?.x ?? 0);
  }
  const reveal = Math.min(1, Math.max(0, (maxX - LOGO.left) / LOGO.width));
  const retract = p(t, 53.2, 53.5, EASE_IN);
  const grow = p(t, 53.45, 53.95, EASE);
  const land = p(t, 53.95, 54.3, BACK);
  const hit = shake(t, 54.0, 18, 0.4);
  const ring = p(t, 54.0, 54.9, EASE);
  const tagIn = (i: number) => p(t, 54.4 + i * 0.08, 54.85 + i * 0.08, EASE);

  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: LAST_CHECK.x - R,
          top: LAST_CHECK.y - R,
          width: R * 2,
          height: R * 2,
          borderRadius: "50%",
          background: C.ink,
        }}
      />
      {t > 50.1 ? <AbsoluteFill style={{ background: C.ink }} /> : null}

      <AbsoluteFill style={{ translate: `${hit.x}px ${hit.y}px` }}>
        {/* wordmark revealed behind the needle */}
        <div
          style={{
            position: "absolute",
            left: LOGO.left,
            top: LOGO_TOP,
            width: LOGO.width,
            height: LOGO_H,
            clipPath: `inset(-20px ${(1 - reveal) * 100}% -20px -20px)`,
            scale: `${t > 53.95 ? mix(1.06, 1, land) : 1}`,
          }}
        >
          <Logo width={LOGO.width} reverse redPath={redGrow(grow)} hideRed={t < 53.45} />
        </div>

        {/* the red thread / needle */}
        {t > 50.55 && t < 53.55 ? (
          <svg width={1080} height={1920} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
            <path
              d={STITCH}
              fill="none"
              stroke={C.red}
              strokeWidth={8}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={`${LEN * prog * (1 - retract)} ${LEN * 2}`}
              strokeDashoffset={-LEN * prog * retract}
            />
            <circle cx={tip.x} cy={tip.y} r={10 * (1 - retract)} fill={C.red} />
          </svg>
        ) : null}

        {/* impact ring */}
        {t > 54.0 && t < 54.9 ? (
          <div
            style={{
              position: "absolute",
              left: A_CENTER.x - 700 * ring,
              top: A_CENTER.y - 700 * ring,
              width: 1400 * ring,
              height: 1400 * ring,
              borderRadius: "50%",
              border: `${mix(10, 1, ring)}px solid ${C.white}`,
              opacity: (1 - ring) * 0.6,
            }}
          />
        ) : null}

        {/* tagline */}
        <div style={{ position: "absolute", top: 1040, width: 1080, textAlign: "center", fontSize: 58, fontWeight: 600, letterSpacing: "-0.03em", color: C.white }}>
          {TAG.map((w, i) => (
            <span key={i} style={{ display: "inline-block", marginRight: "0.24em", opacity: tagIn(i), translate: `0px ${mix(34, 0, tagIn(i))}px` }}>
              {w}
            </span>
          ))}
        </div>

        {/* call to action */}
        {t > 55.9 ? (
          <div style={{ position: "absolute", top: 1160, width: 1080, display: "flex", justifyContent: "center" }}>
            <div
              style={{
                padding: "26px 54px",
                borderRadius: 999,
                background: C.white,
                color: C.ink,
                fontSize: 42,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                scale: `${mix(0.6, 1, p(t, 55.95, 56.3, BACK))}`,
                opacity: p(t, 55.95, 56.1),
              }}
            >
              Talk through your shipment
            </div>
          </div>
        ) : null}

        {t > 57.2 ? (
          <div style={{ position: "absolute", top: 1366, width: 1080, textAlign: "center", fontSize: 26, fontWeight: 500, letterSpacing: "0.04em", color: "#9AA4AD", opacity: p(t, 57.25, 57.6) }}>
            PT Satu Arah International · Jakarta
          </div>
        ) : null}
      </AbsoluteFill>

      {/* agent cameo: waves goodbye */}
      {t > 57.2 ? (
        <Agent
          size={520}
          wave={Math.sin((t - 57.7) * Math.PI * 2 * 2.0) * 12 * p(t, 57.6, 57.8) * (1 - p(t, 59.0, 59.3))}
          style={{ left: 600, top: 1920 - 520, translate: `0px ${mix(600, 0, p(t, 57.25, 57.65, BACK))}px` }}
        />
      ) : null}
    </AbsoluteFill>
  );
};

const Easing2 = (x: number) => EASE_INOUT(x) * 0.15 + x * 0.85;
