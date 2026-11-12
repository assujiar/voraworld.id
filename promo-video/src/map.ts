import { geoDistance, geoInterpolate, geoOrthographic } from "d3-geo";
import { EASE, EASE_IN, EASE_INOUT, mix, p } from "./lib";

export type LonLat = [number, number];
export const JAKARTA: LonLat = [106.85, -6.2];
export const CENTER = { x: 540, y: 860 };

// Real coordinates. Shown as places reached by an arc, not as a claim of fixed lanes.
export const INDO: { name: string; at: LonLat }[] = [
  { name: "Medan", at: [98.67, 3.59] },
  { name: "Batam", at: [104.05, 1.13] },
  { name: "Pontianak", at: [109.33, -0.03] },
  { name: "Surabaya", at: [112.75, -7.25] },
  { name: "Denpasar", at: [115.22, -8.65] },
  { name: "Balikpapan", at: [116.83, -1.27] },
  { name: "Makassar", at: [119.42, -5.14] },
  { name: "Manado", at: [124.84, 1.47] },
  { name: "Ambon", at: [128.18, -3.7] },
  { name: "Jayapura", at: [140.72, -2.53] },
];
export const INDO_T0 = 20.6;
export const INDO_STEP = 0.4;

export const WORLD: { name: string; at: LonLat }[] = [
  { name: "Sydney", at: [151.21, -33.87] },
  { name: "Tokyo", at: [139.69, 35.68] },
  { name: "Busan", at: [129.08, 35.18] },
  { name: "Shanghai", at: [121.47, 31.23] },
  { name: "Hong Kong", at: [114.17, 22.32] },
  { name: "Singapore", at: [103.82, 1.35] },
  { name: "Mumbai", at: [72.88, 19.08] },
  { name: "Dubai", at: [55.27, 25.2] },
  { name: "Jeddah", at: [39.19, 21.49] },
  { name: "Rotterdam", at: [4.48, 51.92] },
  { name: "Hamburg", at: [9.99, 53.55] },
];
export const WORLD_T0 = 25.8;
export const WORLD_STEP = 0.45;

export type View = { lon: number; lat: number; scale: number };

export const viewAt = (t: number): View => {
  // A: Indonesia, slight drift
  let lon = mix(116.5, 114.5, p(t, 19.9, 24.2, (x) => x));
  let lat = -2.5;
  let scale = 1150;
  // B: pull back to the globe
  const z = p(t, 24.2, 25.6, EASE_INOUT);
  scale = Math.exp(mix(Math.log(1150), Math.log(400), z));
  lon = mix(lon, 92, z);
  lat = mix(lat, 12, z);
  // C: spin west so Europe comes round
  const c = p(t, 25.6, 31.0, (x) => EASE_INOUT(x) * 0.4 + x * 0.6);
  lon = mix(lon, 28, c);
  lat = mix(lat, 24, c);
  // D: the globe is sucked into a point for the drop
  const d = p(t, 31.3, 31.95, EASE_IN);
  scale = mix(scale, 6, d);
  lon = mix(lon, 10, d);
  void EASE;
  return { lon, lat, scale };
};

export const projectionFor = (v: View) =>
  geoOrthographic()
    .rotate([-v.lon, -v.lat])
    .scale(v.scale)
    .translate([CENTER.x, CENTER.y])
    .clipAngle(90);

export const visible = (v: View, ll: LonLat) => geoDistance(ll, [v.lon, v.lat]) < Math.PI / 2 - 0.02;

/** projected great-circle arc, lifted off the globe, drawn up to fraction k */
export const arcPath = (v: View, from: LonLat, to: LonLat, k: number) => {
  const proj = projectionFor(v);
  const interp = geoInterpolate(from, to);
  const d = geoDistance(from, to);
  const h = 0.03 + 0.32 * (d / Math.PI);
  const n = 48;
  let out = "";
  let pen = false;
  let head: [number, number] | null = null;
  for (let i = 0; i <= n; i++) {
    const f = (i / n) * k;
    const ll = interp(f) as LonLat;
    if (!visible(v, ll)) {
      pen = false;
      continue;
    }
    const pt = proj(ll);
    if (!pt) {
      pen = false;
      continue;
    }
    const lift = 1 + h * Math.sin(Math.PI * f);
    const x = CENTER.x + (pt[0] - CENTER.x) * lift;
    const y = CENTER.y + (pt[1] - CENTER.y) * lift;
    out += `${pen ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)} `;
    pen = true;
    head = [x, y];
  }
  return { d: out, head };
};

export const jakartaAt = (t: number) => {
  const pt = projectionFor(viewAt(t))(JAKARTA);
  return { x: pt ? pt[0] : CENTER.x, y: pt ? pt[1] : CENTER.y };
};
