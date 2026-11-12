import React from "react";
import { AbsoluteFill, Sequence, staticFile } from "remotion";
import { Audio, Video } from "@remotion/media";
import { Logo } from "./components";
import { C, EASE, EASE_IN, EASE_INOUT, FONT, FOOTER, HEADER, mix, p, useT } from "./lib";
import { Hook, Meet, RedDot } from "./scenes/Intro";
import { Brief } from "./scenes/Brief";
import { Plane, Story } from "./scenes/Story";
import { Close } from "./scenes/Close";

/** header logo: arrives from the opening, visits the "This is VORA" moment, leaves before the ink */
const HeaderLogo: React.FC = () => {
  const t = useT();
  if (t < 6 || t > 49.8) return null;
  const go = p(t, 11.85, 12.45, EASE_INOUT);
  const back = p(t, 14.95, 15.55, EASE_INOUT);
  const k = go * (1 - back);
  const HERO = { left: 160, top: 520, width: 760 };
  const out = p(t, 49.25, 49.65, EASE_IN);
  return (
    <div
      style={{
        position: "absolute",
        left: mix(HEADER.left, HERO.left, k),
        top: mix(HEADER.top, HERO.top, k) - out * 120,
        opacity: 1 - out,
      }}
    >
      <Logo width={mix(HEADER.width, HERO.width, k)} />
    </div>
  );
};

/** footer url: bottom-left on every scene, becomes the big address at the end */
const Footer: React.FC = () => {
  const t = useT();
  if (t < 5.6) return null;
  const inK = p(t, 5.7, 6.2, EASE);
  const end = p(t, 56.45, 57.05, EASE_INOUT);
  const dark = t > 49.92;
  return (
    <div
      style={{
        position: "absolute",
        left: mix(FOOTER.left, 540, end),
        top: mix(FOOTER.top, 1286, end),
        translate: `${-50 * end}% ${mix(16, 0, inK)}px`,
        opacity: inK,
        fontSize: mix(30, 58, end),
        fontWeight: end > 0.5 ? 700 : 600,
        letterSpacing: end > 0.5 ? "-0.01em" : "0.02em",
        color: dark ? (end > 0 ? C.white : "rgba(255,255,255,0.75)") : C.muted,
        whiteSpace: "nowrap",
        display: "flex",
        alignItems: "center",
        gap: 14,
      }}
    >
      <span style={{ display: "inline-block", width: mix(36, 0, end), height: 2, background: dark ? "rgba(255,255,255,0.5)" : C.line }} />
      voraworld.id
    </div>
  );
};

export const VoraPromo: React.FC = () => (
  <AbsoluteFill style={{ background: C.paper, fontFamily: FONT, color: C.ink }}>
    <Sequence durationInFrames={180} name="Opening logo (Hyperframes)">
      <Video src={staticFile("video/opening-logo.mp4")} muted />
    </Sequence>
    <Hook />
    <Meet />
    <Brief />
    <Story />
    <RedDot />
    <Close />
    <HeaderLogo />
    <Footer />
    <Plane />
    <Audio src={staticFile("audio/soundtrack.wav")} />
  </AbsoluteFill>
);
