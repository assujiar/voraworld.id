import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

loadFont({
  family: "Archivo",
  url: staticFile("fonts/archivo-latin-wdth.woff2"),
  weight: "100 900",
  format: "woff2",
});
