// Render selected frames as PNG for visual checks: node scripts/stills.mjs <outdir> <frame> <frame> ...
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";
const [out, ...frames] = process.argv.slice(2);
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const composition = await selectComposition({ serveUrl, id: process.env.COMP || "VoraPromo" });
for (const f of frames) {
  await renderStill({ serveUrl, composition, frame: Number(f), output: path.join(out, `f${String(f).padStart(4, "0")}.png`), scale: 0.5 });
  process.stdout.write(f + " ");
}
console.log("done");
