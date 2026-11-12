"""Build index.html for the VORA opening logo ("Cap Tekan" / stamp press), 0-6 s.

Logo paths are read from the approved SVG (../../public/img/vora-primary.svg) and never redrawn.
The wordmark is revealed in four vertical slabs (V, O, R, A) on the music's four booms.
Run: python build.py
"""
import os, re

HERE = os.path.dirname(os.path.abspath(__file__))
svg = open(os.path.join(HERE, "..", "..", "public", "img", "vora-primary.svg")).read()
INK, RED = re.findall(r'<path[^>]*d="([^"]*)"', svg)
VB = "132 164 1780 384"

# layout (px on the 1080x1920 canvas); header target is shared with Remotion (src/layout.ts)
LOGO_W = 880
LOGO_H = LOGO_W * 384 / 1780
LEFT, TOP = 100, 830
HEAD_LEFT, HEAD_TOP, HEAD_W = 80, 150, 240

# slab cuts in svg-local x (0..1780) where the ligature is crossed by as few strokes as possible
CUTS = [0, 440, 822, 1210, 1780]
slabs = []
for i in range(4):
    a, b = CUTS[i] / 1780 * 100, CUTS[i + 1] / 1780 * 100
    cx = (a + b) / 2
    slabs.append(
        f'<svg class="slab" id="slab{i}" viewBox="{VB}" style="clip-path: polygon({a:.3f}% -5%, {min(b + 0.25, 100.5):.3f}% -5%, {min(b + 0.25, 100.5):.3f}% 105%, {a:.3f}% 105%); transform-origin: {cx:.2f}% 50%">'
        f'<path d="{INK}" fill="#101720"/></svg>'
    )

# red counterform centre in page px
s = LOGO_W / 1780
RCX = LEFT + (1580 - 132) * s
RCY = TOP + (436 - 164) * s

# crop marks around the logo box
pad = 48
bx0, by0, bx1, by1 = LEFT - pad, TOP - pad, LEFT + LOGO_W + pad, TOP + LOGO_H + pad
marks = ""
for i, (x, y, sx, sy) in enumerate([(bx0, by0, 1, 1), (bx1, by0, -1, 1), (bx1, by1, -1, -1), (bx0, by1, 1, -1)]):
    marks += (
        f'<div class="mark" id="mark{i}" style="left:{x}px;top:{y}px;transform:scale({sx},{sy})">'
        f'<i class="h"></i><i class="v"></i></div>'
    )

# impact dashes around each slab centre
dashes = ""
for i in range(4):
    a, b = CUTS[i], CUTS[i + 1]
    cx = LEFT + (a + b) / 2 * s
    cy = TOP + LOGO_H / 2
    for k in range(8):
        ang = k * 45 + 22.5
        dashes += f'<div class="dash d{i}" style="left:{cx}px;top:{cy}px;transform:rotate({ang}deg)"><i></i></div>'

desc = "".join(f'<span class="ch">{c if c != " " else "&nbsp;"}</span>' for c in "FREIGHT & LOGISTICS")

html = f"""<!doctype html>
<html lang="en" data-resolution="portrait">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=1080, height=1920" />
<script src="assets/gsap.min.js"></script>
<style>
@font-face {{ font-family: 'Archivo'; src: url(assets/archivo-latin-wdth.woff2) format('woff2'); font-weight: 100 900; font-stretch: 62% 125%; }}
:root {{ --paper:#F7F7F4; --ink:#101720; --red:#B43E31; --muted:#64717C; --line:#DCE0E1; }}
* {{ margin:0; padding:0; box-sizing:border-box; }}
html, body {{ width:1080px; height:1920px; overflow:hidden; background:var(--paper); }}
#root {{ position:relative; width:1080px; height:1920px; background:var(--paper); font-family:'Archivo', Arial, sans-serif; }}
#stage {{ position:absolute; inset:0; }}
#fly {{ position:absolute; left:{LEFT}px; top:{TOP}px; width:{LOGO_W}px; height:{LOGO_H:.2f}px; transform-origin:0 0; }}
.slab {{ position:absolute; inset:0; width:100%; height:100%; overflow:visible; }}
#red {{ overflow:visible; }}
.slab {{ opacity:0; }}
#redwrap {{ position:absolute; left:{RCX - LEFT}px; top:{RCY - TOP}px; width:0; height:0; }}
#red {{ position:absolute; left:{-(RCX - LEFT)}px; top:{-(RCY - TOP)}px; width:{LOGO_W}px; height:{LOGO_H:.2f}px; }}
.mark {{ position:absolute; width:0; height:0; opacity:0; }}
.mark i {{ position:absolute; background:var(--ink); left:0; top:0; }}
.mark .h {{ width:56px; height:3px; transform-origin:0 0; }}
.mark .v {{ width:3px; height:56px; transform-origin:0 0; }}
#baseline {{ position:absolute; left:{LEFT}px; top:{TOP + LOGO_H + 22}px; width:{LOGO_W}px; height:2px; background:var(--line); transform-origin:0 50%; transform:scaleX(0); }}
.dash {{ position:absolute; width:0; height:0; }}
.dash i {{ position:absolute; left:150px; top:-2px; width:46px; height:4px; background:var(--ink); transform-origin:-150px 50%; transform:scaleX(0); opacity:0; }}
.ring {{ position:absolute; left:{RCX}px; top:{RCY}px; width:0; height:0; }}
.ring i {{ position:absolute; left:-400px; top:-400px; width:800px; height:800px; border-radius:50%; border:3px solid var(--ink); transform:scale(0); opacity:0; }}
#desc {{ position:absolute; left:0; width:1080px; top:{TOP + LOGO_H + 52}px; text-align:center; font-size:36px; font-weight:600; letter-spacing:0.18em; color:var(--muted); }}
#desc .ch {{ display:inline-block; opacity:0; transform:translateY(26px); }}
</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="6" data-width="1080" data-height="1920">
  <div id="stage" class="clip" data-start="0" data-duration="6" data-track-index="0">
    {marks}
    <div id="baseline"></div>
    {dashes}
    <div class="ring" id="ring0"><i></i></div>
    <div class="ring" id="ring1"><i></i></div>
    <div id="fly">
      {''.join(slabs)}
      <div id="redwrap"><svg id="red" viewBox="{VB}"><path d="{RED}" fill="#B43E31"/></svg></div>
    </div>
    <div id="desc">{desc}</div>
  </div>
</div>
<script>
window.__timelines = window.__timelines || {{}};
const tl = gsap.timeline({{ paused: true }});

// 0.0-0.9  print registration: crop marks tick in on the clock, baseline draws
[0, 0.125, 0.25, 0.375].forEach((t, i) => {{
  tl.set('#mark' + i, {{ opacity: 1 }}, t);
  tl.fromTo('#mark' + i + ' .h', {{ scaleX: 0 }}, {{ scaleX: 1, duration: 0.12, ease: 'power3.out' }}, t);
  tl.fromTo('#mark' + i + ' .v', {{ scaleY: 0 }}, {{ scaleY: 1, duration: 0.12, ease: 'power3.out' }}, t);
}});
tl.to('#baseline', {{ scaleX: 1, duration: 0.45, ease: 'power2.inOut' }}, 0.45);

// 0.55-1.0 the red counterform shoots in on an arc, spinning, and lands in the A
tl.fromTo('#redwrap', {{ x: 420, rotation: 540, scale: 3.2 }}, {{ x: 0, rotation: 0, scale: 1, duration: 0.45, ease: 'power2.out' }}, 0.55);
tl.fromTo('#redwrap', {{ y: 900 }}, {{ y: 0, duration: 0.45, ease: 'power4.out' }}, 0.55);
tl.to('#redwrap', {{ scaleY: 0.82, scaleX: 1.12, duration: 0.05, ease: 'power2.out' }}, 1.0);
tl.to('#redwrap', {{ scaleY: 1, scaleX: 1, duration: 0.22, ease: 'back.out(3)' }}, 1.05);
tl.fromTo('#ring0 i', {{ scale: 0, opacity: 0.45 }}, {{ scale: 0.35, opacity: 0, duration: 0.5, ease: 'power2.out' }}, 1.0);
tl.to('#baseline', {{ opacity: 0, duration: 0.3 }}, 1.6);

// 2.0 / 2.5 / 3.0 / 3.5 the four slabs stamp down on the booms
const T = [2.0, 2.5, 3.0, 3.5];
const shakes = [
  [9, -7, 5, -3, 1.5, 0],
  [10, -8, 5, -3, 1.5, 0],
  [11, -9, 6, -3, 1.5, 0],
  [20, -15, 10, -6, 3, 0],
];
T.forEach((t, i) => {{
  tl.fromTo('#slab' + i, {{ opacity: 0, scale: 1.45, y: -40 }}, {{ opacity: 1, scale: 1, y: 0, duration: 0.1, ease: 'power4.in' }}, t - 0.1);
  tl.fromTo('.d' + i + ' i', {{ scaleX: 0, opacity: 1 }}, {{ scaleX: 1, duration: 0.14, ease: 'power3.out' }}, t);
  tl.to('.d' + i + ' i', {{ opacity: 0, duration: 0.16 }}, t + 0.12);
  shakes[i].forEach((v, k) => {{
    tl.to('#stage', {{ x: v * (k % 2 ? 1 : -1) * 0.6, y: v, duration: 0.045, ease: 'none' }}, t + k * 0.045);
  }});
}});
// the last slab is the A: biggest hit, rings, crop marks snap away
tl.fromTo('#ring0 i', {{ scale: 0, opacity: 0.5 }}, {{ scale: 1.25, opacity: 0, duration: 0.9, ease: 'power2.out' }}, 3.5);
tl.fromTo('#ring1 i', {{ scale: 0, opacity: 0.35 }}, {{ scale: 1.7, opacity: 0, duration: 1.1, ease: 'power2.out' }}, 3.58);
[0, 1, 2, 3].forEach(i => {{
  const dx = i === 0 || i === 3 ? -70 : 70, dy = i < 2 ? -70 : 70;
  tl.to('#mark' + i, {{ x: dx, y: dy, opacity: 0, duration: 0.3, ease: 'power3.out' }}, 3.5);
}});

// 4.0 descriptor rises letter by letter
tl.to('#desc .ch', {{ opacity: 1, y: 0, duration: 0.35, ease: 'power3.out', stagger: 0.025 }}, 4.0);

// 5.0-5.8 the logo flies to the header; the descriptor clears first
tl.to('#desc .ch', {{ opacity: 0, y: -18, duration: 0.25, ease: 'power2.in', stagger: 0.01 }}, 4.85);
tl.to('#fly', {{ x: {HEAD_LEFT - LEFT}, y: {HEAD_TOP - TOP}, scale: {HEAD_W / LOGO_W:.6f}, duration: 0.8, ease: 'expo.inOut' }}, 5.0);

window.__timelines['main'] = tl;
tl.seek(0);
</script>
</body>
</html>
"""
open(os.path.join(HERE, "index.html"), "w").write(html)
print("index.html written")
