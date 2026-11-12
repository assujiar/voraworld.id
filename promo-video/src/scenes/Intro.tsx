import React from "react";
import { AbsoluteFill } from "remotion";
import { Agent, KNOT, Label } from "../components";
import { BACK, C, EASE, EASE_IN, mix, p, shake, useT } from "../lib";

// ---------------------------------------------------------------- geometry
export const AGENT_MEET = { left: 360, top: 1160, size: 760 };
const S = AGENT_MEET.size / 1254;
const KNOT_PAGE = { x: AGENT_MEET.left + KNOT.x * S, y: AGENT_MEET.top + KNOT.y * S };

/** vertical offset of the agent in the Meet scene (rise, then exit) */
export const agentMeetY = (t: number) =>
  mix(820, 0, p(t, 10.72, 11.12, BACK)) + mix(0, 900, p(t, 15.2, 15.85, EASE_IN));

/** where the scarf knot is on the page at time t */
export const knotAt = (t: number) => ({ x: KNOT_PAGE.x, y: KNOT_PAGE.y + agentMeetY(t) });

const WORDS = ["Every", "shipment", "is", "different"];
const BEATS = [6.5, 7.0, 7.5, 8.0];
const RIGHT = 920;
const TOPS = [520, 680, 840, 1000];
const DOT = { x: 950, y: 1104, r: 19 };

// ---------------------------------------------------------------- hook 6-11
export const Hook: React.FC = () => {
  const t = useT();
  if (t < 6 || t > 10.6) return null;
  const sh = BEATS.reduce(
    (acc, b) => {
      const s = shake(t, b, 12, 0.3);
      return { x: acc.x + s.x, y: acc.y + s.y };
    },
    { x: 0, y: 0 },
  );
  return (
    <AbsoluteFill style={{ translate: `${sh.x}px ${sh.y}px` }}>
      {WORDS.map((w, i) => {
        const inK = p(t, BEATS[i] - 0.13, BEATS[i], EASE_IN);
        const outK = p(t, 9.7 + i * 0.06, 10.15 + i * 0.06, EASE_IN);
        return (
          <div
            key={w}
            style={{
              position: "absolute",
              right: 1080 - RIGHT,
              top: TOPS[i],
              fontSize: 168,
              fontWeight: 700,
              letterSpacing: "-0.045em",
              lineHeight: 1,
              color: C.ink,
              opacity: inK * (1 - outK),
              scale: `${mix(1.7, 1, inK)}`,
              transformOrigin: "100% 60%",
              translate: `${mix(0, -260, outK)}px 0px`,
              filter: `blur(${(1 - inK) * 14}px)`,
            }}
          >
            {w}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/** the red full stop: pops after "different", drops, and becomes the scarf knot */
export const RedDot: React.FC = () => {
  const t = useT();
  if (t < 8.4 || t > 11.5) return null;
  const pop = p(t, 8.45, 8.62, BACK);
  const k = knotAt(t);
  const fx = p(t, 10.2, 11.02, EASE);
  const fy = p(t, 10.2, 11.02, EASE_IN);
  const x = mix(DOT.x, k.x, fx);
  const y = mix(DOT.y, k.y, fy) - Math.sin(fx * Math.PI) * 120;
  const merge = p(t, 11.04, 11.3, EASE);
  const r = DOT.r * pop * (1 - merge);
  const ring = p(t, 11.02, 11.45, EASE);
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: x - r,
          top: y - r,
          width: r * 2,
          height: r * 2,
          borderRadius: "50%",
          background: C.red,
        }}
      />
      {t > 11.02 ? (
        <div
          style={{
            position: "absolute",
            left: k.x - 90 * ring,
            top: k.y - 90 * ring,
            width: 180 * ring,
            height: 180 * ring,
            borderRadius: "50%",
            border: `4px solid ${C.red}`,
            opacity: 1 - ring,
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- meet 11-17
const LINE = "Freight and logistics, planned before the cargo moves.".split(" ");

export const Meet: React.FC = () => {
  const t = useT();
  if (t < 10.6 || t > 16.2) return null;
  const waveEnv = p(t, 11.3, 11.5) * (1 - p(t, 12.7, 13.0));
  const wave = Math.sin((t - 11.3) * Math.PI * 2 * 2.1) * 13 * waveEnv;
  const breathe = 1 + Math.sin(t * Math.PI) * 0.006;
  const labelK = p(t, 11.85, 12.2);
  const out = p(t, 14.85, 15.25, EASE_IN);
  return (
    <AbsoluteFill>
      <Label
        style={{
          position: "absolute",
          top: 452,
          width: 1080,
          textAlign: "center",
          opacity: labelK * (1 - out),
          translate: `0px ${mix(24, 0, labelK) - out * 30}px`,
          fontSize: 32,
        }}
      >
        This is
      </Label>
      <div
        style={{
          position: "absolute",
          top: 740,
          left: 100,
          width: 880,
          textAlign: "center",
          fontSize: 60,
          fontWeight: 600,
          letterSpacing: "-0.03em",
          lineHeight: 1.12,
          color: C.ink,
        }}
      >
        {LINE.map((w, i) => {
          const k = p(t, 12.85 + i * 0.07, 13.25 + i * 0.07);
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                marginRight: "0.26em",
                opacity: k * (1 - out),
                translate: `0px ${mix(36, 0, k) - out * 30}px`,
              }}
            >
              {w}
            </span>
          );
        })}
      </div>
      <Agent
        size={AGENT_MEET.size}
        wave={wave}
        style={{
          left: AGENT_MEET.left,
          top: AGENT_MEET.top,
          translate: `0px ${agentMeetY(t)}px`,
          scale: `${breathe}`,
          transformOrigin: "50% 100%",
        }}
      />
    </AbsoluteFill>
  );
};
