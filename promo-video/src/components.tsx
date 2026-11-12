import React from "react";
import { Img, staticFile } from "remotion";
import { INK_PATH, LOGO_VIEWBOX, RED_PATH } from "./logo";
import { C } from "./lib";

/** The approved VORA wordmark. `reverse` = white wordmark with the unchanged red counterform. */
export const Logo: React.FC<{
  width: number;
  reverse?: boolean;
  redPath?: string;
  hideRed?: boolean;
  style?: React.CSSProperties;
}> = ({ width, reverse, redPath, hideRed, style }) => (
  <svg
    viewBox={LOGO_VIEWBOX}
    width={width}
    height={(width * 384) / 1780}
    style={{ display: "block", overflow: "visible", ...style }}
  >
    <path d={INK_PATH} fill={reverse ? C.white : C.ink} />
    {hideRed ? null : <path d={redPath ?? RED_PATH} fill={C.red} />}
  </svg>
);

/** counterform as points, so it can grow out of its own curved base (used by the closing logo) */
const RED_POINTS: [number, number][] = (() => {
  const nums = RED_PATH.replace(/[MLZ]/g, " ").trim().split(/\s+/).map(Number);
  const pts: [number, number][] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
  return pts;
})();
// concave base of the counterform: quadratic through (1423,520) (1584,481) (1738,519)
const baseY = (x: number) => {
  const x0 = 1423, x1 = 1584, x2 = 1738, y0 = 520, y1 = 481, y2 = 519;
  const l0 = ((x - x1) * (x - x2)) / ((x0 - x1) * (x0 - x2));
  const l1 = ((x - x0) * (x - x2)) / ((x1 - x0) * (x1 - x2));
  const l2 = ((x - x0) * (x - x1)) / ((x2 - x0) * (x2 - x1));
  return Math.max(y0 * l0 + y1 * l1 + y2 * l2, 0);
};
/** k = 0: flat sliver lying on the base; k = 1: the exact approved counterform */
export const redGrow = (k: number) =>
  "M" +
  RED_POINTS.map(([x, y]) => `${x.toFixed(1)} ${(baseY(x) + (y - baseY(x)) * k).toFixed(1)}`).join(" L") +
  "Z";

/** VORA Agent puppet: body + hand layers from the supplied artwork. Hand waves around the wrist. */
export const Agent: React.FC<{
  size: number;
  wave: number; // hand rotation in degrees
  style?: React.CSSProperties;
}> = ({ size, wave, style }) => {
  const s = size / 1254;
  return (
    <div style={{ position: "absolute", width: size, height: size, ...style }}>
      <Img
        src={staticFile("img/agent_hand.webp")}
        style={{
          position: "absolute",
          inset: 0,
          width: size,
          height: size,
          transformOrigin: `${910 * s}px ${628 * s}px`,
          rotate: `${wave}deg`,
        }}
      />
      <Img src={staticFile("img/agent_body.webp")} style={{ position: "absolute", inset: 0, width: size, height: size }} />
    </div>
  );
};

/** scarf knot position inside the agent artwork (1254 px space) */
export const KNOT = { x: 585, y: 542 };

export const Label: React.FC<{ children: React.ReactNode; style?: React.CSSProperties; color?: string }> = ({
  children,
  style,
  color = C.muted,
}) => (
  <div
    style={{
      fontSize: 28,
      fontWeight: 600,
      letterSpacing: "0.14em",
      textTransform: "uppercase",
      color,
      ...style,
    }}
  >
    {children}
  </div>
);
