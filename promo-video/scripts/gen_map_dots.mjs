// Precompute a dot-matrix of land (Natural Earth 50m via world-atlas) -> src/mapDots.json
// Indonesia region gets a denser grid so the archipelago reads clearly when zoomed in.
import fs from "node:fs";
import { geoContains } from "d3-geo";
import { feature } from "topojson-client";
const topo = JSON.parse(fs.readFileSync("node_modules/world-atlas/land-50m.json", "utf8"));
const land = feature(topo, topo.objects.land);
const dots = [];
const inIndo = (lon, lat) => lon >= 94 && lon <= 142 && lat >= -11.5 && lat <= 7;
for (let lat = -58; lat <= 78; lat += 1.6) {
  for (let lon = -180; lon < 180; lon += 1.6) {
    if (inIndo(lon, lat)) continue;
    if (geoContains(land, [lon, lat])) dots.push([+lon.toFixed(2), +lat.toFixed(2), 0]);
  }
}
for (let lat = -11.5; lat <= 7; lat += 0.42) {
  for (let lon = 94; lon <= 142; lon += 0.42) {
    if (geoContains(land, [lon, lat])) dots.push([+lon.toFixed(2), +lat.toFixed(2), 1]);
  }
}
fs.writeFileSync("src/mapDots.json", JSON.stringify(dots));
console.log("dots", dots.length, "indo", dots.filter((d) => d[2]).length);
