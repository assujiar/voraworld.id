import { createContext, useContext } from "react";
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

/** "full" = the 66 s master; "gbp" = the 59.8 s edit (brief tightened, plan sheet removed) */
export type Variant = "full" | "gbp";
export const VariantCtx = createContext<Variant>("full");
export const useVariant = () => useContext(VariantCtx);

/** gbp edit time -> master time. Brief 14.3-17.9 plays the master's 14.3-19.9; then +2 s; from 50 s, +6 s (plan sheet cut). */
export const gbpToMaster = (t: number) => {
  if (t < 14.3) return t;
  if (t < 17.9) return 14.3 + (t - 14.3) * (5.6 / 3.6);
  if (t < 50) return t + 2;
  return t + 6;
};

export const C = {
  ink: "#101720",
  red: "#B43E31",
  white: "#FFFFFF",
  paper: "#F7F7F4",
  line: "#DCE0E1",
  muted: "#64717C",
  tint: "#E9ECEE",
  deep: "#0B1219",
};

export const FONT = "Archivo, Arial, sans-serif";

/** VORA motion token: cubic-bezier(.2,.8,.2,1) */
export const EASE = Easing.bezier(0.2, 0.8, 0.2, 1);
export const EASE_IN = Easing.bezier(0.55, 0, 0.9, 0.4);
export const EASE_INOUT = Easing.bezier(0.7, 0, 0.2, 1);
export const BACK = Easing.out(Easing.back(1.6));

/** current time in seconds on the master clock */
export const useT = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const v = useContext(VariantCtx);
  const t = frame / fps;
  return v === "gbp" ? gbpToMaster(t) : t;
};

/** 0..1 progress between a and b seconds, clamped */
export const p = (t: number, a: number, b: number, easing: (n: number) => number = EASE) =>
  interpolate(t, [a, b], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing,
  });

export const mix = (a: number, b: number, k: number) => a + (b - a) * k;

/** damped shake after an impact at time t0 */
export const shake = (t: number, t0: number, amp: number, dur = 0.35) => {
  if (t < t0 || t > t0 + dur) return { x: 0, y: 0 };
  const k = (t - t0) / dur;
  const d = amp * (1 - k) * (1 - k);
  return { x: Math.sin(k * 55) * d * 0.7, y: Math.cos(k * 47) * d };
};

/** shared header/footer geometry (matches the Hyperframes opening) */
export const HEADER = { left: 420, top: 96, width: 240 };
export const LOGO_RATIO = 384 / 1780;
export const FOOTER = { left: 540, top: 1796 };

/** the services window centre */
export const WIN = { cx: 540, cy: 860 };
