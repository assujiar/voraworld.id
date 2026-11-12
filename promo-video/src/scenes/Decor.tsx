import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { BACK, C, EASE, EASE_IN, mix, p, useT } from "../lib";
import { jakartaAt } from "../map";

type Obj = { src: string; x: number; y: number; size: number; tin: number; tout: number; rot: number; toJakarta?: boolean };

// VORA's own 3D objects, placed in the empty parts of each frame and entering on the beat
const OBJECTS: Obj[] = [
  // hook 6-10
  { src: "containers", x: 250, y: 360, size: 290, tin: 6.5, tout: 9.3, rot: -6 },
  { src: "global-globe", x: 835, y: 350, size: 240, tin: 7.0, tout: 9.35, rot: 8 },
  { src: "export-crate", x: 210, y: 1400, size: 260, tin: 7.5, tout: 9.4, rot: 5 },
  { src: "stopwatch", x: 850, y: 1405, size: 250, tin: 8.0, tout: 9.45, rot: -8 },
  // meet 10-14.5
  { src: "pallets", x: 190, y: 300, size: 200, tin: 10.4, tout: 13.9, rot: -5 },
  { src: "reefer", x: 885, y: 300, size: 200, tin: 10.7, tout: 13.95, rot: 6 },
  { src: "air-pallet", x: 200, y: 1250, size: 290, tin: 11.0, tout: 14.0, rot: -4 },
  { src: "document-stack", x: 170, y: 1540, size: 210, tin: 11.3, tout: 14.05, rot: 8 },
  // brief 14.5-19.9: each one arrives with the field it belongs to, then all are pulled into Jakarta
  { src: "forklift", x: 540, y: 285, size: 170, tin: 15.6, tout: 19.45, rot: 4, toJakarta: true },
  { src: "export-crate", x: 200, y: 300, size: 180, tin: 16.3, tout: 19.45, rot: -6, toJakarta: true },
  { src: "location", x: 200, y: 1530, size: 210, tin: 17.0, tout: 19.45, rot: -4, toJakarta: true },
  { src: "global-globe", x: 540, y: 1545, size: 230, tin: 17.7, tout: 19.45, rot: 6, toJakarta: true },
  { src: "schedule", x: 880, y: 1530, size: 210, tin: 18.4, tout: 19.45, rot: 5, toJakarta: true },
];

const Floater: React.FC<{ o: Obj; i: number; t: number }> = ({ o, i, t }) => {
  if (t < o.tin - 0.05 || t > o.tout + 0.6) return null;
  const k = p(t, o.tin, o.tin + 0.38, BACK);
  const out = p(t, o.tout, o.tout + 0.5, EASE_IN);
  const jk = jakartaAt(19.95);
  const bob = Math.sin(t * 1.4 + i * 1.7) * 12;
  const sway = Math.sin(t * 0.9 + i) * 3;
  let x = o.x;
  let y = o.y + bob + mix(60, 0, k);
  let scale = k;
  let opacity = Math.min(1, k * 1.5);
  if (o.toJakarta) {
    x = mix(x, jk.x, out);
    y = mix(y, jk.y, out);
    scale *= 1 - out;
  } else {
    x = mix(x, x < 540 ? -300 : 1380, out);
    scale *= 1 - out * 0.4;
    opacity *= 1 - out;
  }
  return (
    <Img
      src={staticFile(`img/obj/${o.src}.webp`)}
      style={{
        position: "absolute",
        left: x - o.size / 2,
        top: y - o.size / 2,
        width: o.size,
        height: o.size,
        objectFit: "contain",
        scale: `${scale}`,
        rotate: `${o.rot * (1 - k) * 4 + sway + o.rot * 0.3}deg`,
        opacity,
        filter: "drop-shadow(0 28px 30px rgba(16,23,32,0.18))",
      }}
    />
  );
};

/** decor for the paper half (6-20 s) */
export const Decor: React.FC = () => {
  const t = useT();
  if (t < 5.9 || t > 20.5) return null;
  const lanesIn = p(t, 6.0, 6.8) * (1 - p(t, 19.6, 20.0));

  // diagonal marquee tape behind the agent in the meet scene
  const tapeIn = p(t, 9.95, 10.45, EASE);
  const tapeOut = p(t, 13.95, 14.4, EASE_IN);
  const TAPE = "FREIGHT & LOGISTICS  ·  JAKARTA  ·  BRINGING THE WORLD WITHIN REACH  ·  ";

  return (
    <AbsoluteFill>
      {/* moving lanes */}
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0, opacity: lanesIn }}>
        {[0, 1, 2].map((n) => {
          const d = `M -100 ${1500 + n * 170} C 300 ${1300 + n * 140}, 700 ${700 + n * 120}, 1180 ${420 + n * 160}`;
          return (
            <g key={n}>
              <path d={d} fill="none" stroke={n === 1 ? "#C9CFD2" : "#DADEDF"} strokeWidth={n === 1 ? 4 : 3} strokeDasharray="3 16" strokeLinecap="round" strokeDashoffset={-t * (60 + n * 20)} />
            </g>
          );
        })}
      </svg>
      {/* moving dots on the lanes (computed, so they render frame-accurately) */}
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0, opacity: lanesIn }}>
        {[0, 1, 2].map((n) => {
          const k = ((t * (0.09 + n * 0.025) + n * 0.33) % 1 + 1) % 1;
          const x0 = -100, x3 = 1180;
          const y0 = 1500 + n * 170, y1 = 1300 + n * 140, y2 = 700 + n * 120, y3 = 420 + n * 160;
          const u = 1 - k;
          const x = u * u * u * x0 + 3 * u * u * k * 300 + 3 * u * k * k * 700 + k * k * k * x3;
          const y = u * u * u * y0 + 3 * u * u * k * y1 + 3 * u * k * k * y2 + k * k * k * y3;
          return <rect key={n} x={x - 14} y={y - 9} width={28} height={18} rx={4} fill={C.ink} transform={`rotate(-32 ${x} ${y})`} />;
        })}
      </svg>

      {tapeIn > 0 && tapeOut < 1 ? (
        <div
          style={{
            position: "absolute",
            left: -200,
            top: 1010,
            width: 1500,
            height: 112,
            background: C.ink,
            rotate: "-7deg",
            translate: `${mix(-1500, 0, tapeIn) + tapeOut * 1500}px 0px`,
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
          }}
        >
          <div style={{ whiteSpace: "nowrap", fontSize: 50, fontWeight: 800, letterSpacing: "0.04em", color: C.white, translate: `${-((t * 160) % 1400)}px 0px` }}>
            {TAPE.repeat(4)}
          </div>
        </div>
      ) : null}

      {OBJECTS.map((o, i) => (
        <Floater key={i} o={o} i={i} t={t} />
      ))}
    </AbsoluteFill>
  );
};
