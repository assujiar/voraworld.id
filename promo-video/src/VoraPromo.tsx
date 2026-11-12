import React from "react";
import { AbsoluteFill, Sequence, staticFile } from "remotion";
import { Audio, Video } from "@remotion/media";
import { Logo } from "./components";
import { C, EASE, EASE_IN, EASE_INOUT, FONT, FOOTER, HEADER, mix, p, useT } from "./lib";
import { Hook, Meet, RedDot } from "./scenes/Intro";
import { Brief } from "./scenes/Brief";
import { Plane, Services } from "./scenes/Services";
import { MapScene } from "./scenes/MapScene";
import { Backdrop } from "./scenes/Backdrop";
import { Decor } from "./scenes/Decor";
import { Close } from "./scenes/Close";

/** header logo: arrives from the opening, visits the "This is VORA" moment, leaves before the ink */
const HeaderLogo: React.FC = () => {
  const t = useT();
  if (t < 6 || t > 55.8) return null;
  const go = p(t, 10.85, 11.45, EASE_INOUT);
  const back = p(t, 13.95, 14.55, EASE_INOUT);
  const k = go * (1 - back);
  const HERO = { left: 160, top: 520, width: 760 };
  const out = p(t, 55.25, 55.65, EASE_IN);
  const rev = p(t, 20.15, 20.35);
  return (
    <div
      style={{
        position: "absolute",
        left: mix(HEADER.left, HERO.left, k),
        top: mix(HEADER.top, HERO.top, k) - out * 120,
        opacity: 1 - out,
      }}
    >
      <div style={{ position: "relative" }}>
        <Logo width={mix(HEADER.width, HERO.width, k)} style={{ opacity: 1 - rev }} />
        <Logo width={mix(HEADER.width, HERO.width, k)} reverse style={{ position: "absolute", left: 0, top: 0, opacity: rev }} />
      </div>
    </div>
  );
};

/** footer url: centred at the bottom of every scene, rises to become the big address at the end */
const Footer: React.FC = () => {
  const t = useT();
  if (t < 5.6) return null;
  const inK = p(t, 5.7, 6.2, EASE);
  const end = p(t, 62.45, 63.05, EASE_INOUT);
  const dark = t > 20.25;
  const dash = mix(34, 0, end);
  const lineC = dark ? "rgba(255,255,255,0.45)" : "#C9CFD2";
  return (
    <div
      style={{
        position: "absolute",
        left: 540,
        top: mix(FOOTER.top, 1286, end),
        translate: `-50% ${mix(16, 0, inK)}px`,
        opacity: inK,
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "8px 22px",
        borderRadius: 999,
        background: dark ? `rgba(16,23,32,${0.75 * (1 - end)})` : "rgba(247,247,244,0.92)",
        fontSize: mix(30, 58, end),
        fontWeight: end > 0.5 ? 700 : 600,
        letterSpacing: end > 0.5 ? "-0.01em" : "0.03em",
        color: dark ? (end > 0 ? C.white : "rgba(255,255,255,0.8)") : C.muted,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ display: "inline-block", width: dash, height: 2, background: lineC }} />
      voraworld.id
      <span style={{ display: "inline-block", width: dash, height: 2, background: lineC }} />
    </div>
  );
};

export const VoraPromo: React.FC = () => (
  <AbsoluteFill style={{ background: C.paper, fontFamily: FONT, color: C.ink }}>
    <Backdrop />
    <Decor />
    <Sequence durationInFrames={180} name="Opening logo (Hyperframes)">
      <Video src={staticFile("video/opening-logo.mp4")} muted />
    </Sequence>
    <Hook />
    <Meet />
    <Brief />
    <MapScene />
    <Services />
    <RedDot />
    <Close />
    <HeaderLogo />
    <Footer />
    <Plane />
    <Audio src={staticFile("audio/soundtrack.wav")} />
  </AbsoluteFill>
);
