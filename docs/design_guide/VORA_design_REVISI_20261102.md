---
title: "VORA : Master Digital Design System & Experience Specification"
subtitle: "Mandatory art direction, responsive layout, motion, UI patterns and implementation quality gates"
version: "2.2"
status: "Normative design specification"
date: "2026-11-02"
brand: "VORA"
legal_entity: "PT Satu Arah International"
canonical_website: "https://voraworld.id"
repository: "assujiar/voraworld.id"
---

# VORA : MASTER DESIGN SYSTEM

**Version 2.2 · 2 November 2026**  
**Scope:** Public website, bilingual content, service pages, CMS-powered sections, lead/RFQ journeys, admin/business portal, official document previews, verification pages and branded loading/feedback experiences.  
**Primary audience:** Designers, frontend engineers, Claude Code and any agent modifying the VORA repository.  
**Status:** **MANDATORY creative and UX direction**. This is a target-state standard, not a claim that every rule is already implemented.

> **Non-negotiable brief:** Build an unmistakably VORA experience: **realistic sculptural 3D + restrained claymorphism + precise neumorphic depth + premium editorial composition + purposeful immersive motion + credible B2B logistics operations**. Visually confident, architectural, tactile and sophisticated. Not a template. Not a toy. Not a dashboard pretending to be a corporate site.

## 00. Document authority and interpretation

### 00.1 Source of truth and precedence

1. **Official VORA identity files** and any owner-approved logo/icon/stamp geometry are immutable sources of truth. Do not recreate them with text, a generic monogram, an icon library or approximate SVG paths.
2. **This `design.md` governs design decisions** and acceptance criteria unless the owner explicitly approves an exception.
3. **Existing product rules, backend contracts, legal/privacy requirements and functioning workflows** remain in force. Redesign is not authorization to delete features, routes, fields, database behavior, document metadata or critical information.
4. Existing CSS, components and assets are implementation input, not proof that the visual outcome is approved. Inspect before refactoring; retain what works, remove redundancy only after visual regression checks.
5. For unsupported measurements, page inventory or asset paths, inspect the current codebase. **Never pretend that a proposal is a verified existing implementation.**

### 00.2 Design objective

VORA must look like a serious international logistics business with operational competence, not a generic freight marketplace, a SaaS startup or a portfolio for 3D toys. The identity needs authority at first glance, detail upon inspection and clear routes to commercial action. Every visual gesture must justify itself through **meaning, navigation, material realism or brand character**.

### 00.3 Absolute prohibitions

- No generic SaaS hero with centered headline, two colored buttons and three identical feature cards by default.
- No repetitive alternating left-image/right-copy sections throughout an entire page; no endless rounded-card mosaics.
- No inflated marshmallow shapes, glossy plastic toys, cute mascot characters, neon cyberpunk, oversaturated gradients, clip-art trucks or fake logistics dashboards.
- No blurred glassmorphism sheets as the main visual language; no blanket shadows on every block; no excessive floating pills or decorative badges.
- No generic network-globe or infinity-route imagery repeated page after page; no reused hero illustration disguised by scale, crop or background color.
- No fabricated customer logos, partnerships, shipment counts, certifications, service guarantees, transit-time claims, locations, client testimonials, prices or operational results.
- No scroll-triggered reveal requirement. Content must be visible without crossing an intersection threshold. No custom cursor, cursor trail, magnetic controls or pointer-following 3D tilt.
- No redesign that swaps React/Next.js for Python templates, replaces Supabase, damages document issuance, or breaks the existing public/admin routing.
- No public company phone number or WhatsApp number. No public-facing link to the admin portal.

---

## 01. Brand character and visual narrative

### 01.1 Positioning

**VORA is a composed, modern, technically fluent logistics brand.** The visual language combines physicality with precision: heavyweight cargo geometry; engineered curves; precise typographic hierarchy; convincing soft lighting; paper and metal; structured route lines; curated negative space; substantial, not whimsical, motion.

**Five defining qualities:**

| Quality | Visible expression | Anti-pattern |
|---|---|---|
| Architectural | Editorial grids, monumental headings, measured mass and negative space | Cookie-cutter landing page |
| Tactile | Believable relief, contact shadows, satin/matte surfaces | Plastic balloon or stock clay icon |
| Operational | Route logic, cargo process, actual service taxonomy and technical context | Empty marketing slogans |
| International | Native bilingual writing, global logistics notation, precise wayfinding | Flags everywhere, fake worldwide coverage |
| Restrained | Limited red, quiet detail, disciplined pacing | Attention-seeking gradients or constant animation |

### 01.2 Desired first impression

The first 5 seconds should communicate **a distinct identity, a substantive logistics offering and a clear path to request service**. In the next 20 seconds, a visitor should be able to understand VORA's service categories and why a buyer would speak to the team. Immersive visuals are an advantage only when they do not obstruct that progression.

### 01.3 Composition hierarchy

Use a deliberate three-layer system:

1. **Editorial canvas:** typographic framing, asymmetric composition, large quiet surfaces, thin structural rules and purposeful whitespace.
2. **Physical subject:** one hero-grade realistic 3D sculpture or well-art-directed real logistics visual per primary composition; avoid an army of small renderings.
3. **Precision detail:** numbered indexes, captions, labels, coordinates/routes only when meaningful, and unobtrusive motion.

The physical subject is the visual anchor, **not** a substitute for content. The editorial canvas carries the argument.

---

## 02. Brand identity: immutable rules

### 02.1 Logo geometry

The official **VORA custom connected wordmark** must be imported from the approved source SVG. Its custom **A** contains a distinct **curved red triangular insert**; that shape is not a generic arrow, letter counter or geometric replacement. Preserve the correct A/insert spacing, insertion size, overall kerning, line work, joins, viewBox, proportions and optical alignment. Do not use font substitution or a new letter A.

The correct standalone icon is **the official A letterform plus its exact red curved insert**, isolated from the approved master, not a VO icon or a newly designed monogram.

### 02.2 Color modes

| Usage | Required treatment |
|---|---|
| Light paper | Original approved dark wordmark with the red A insert, on an unobstructed neutral background |
| Dark ink surface | White wordmark with the same red A insert; no white backing panel or box |
| Brand icon | Exact A + insert combination from the source asset |
| Monochrome mark | Only where necessary for one-color print/stamp use, using an approved single-color derivative |
| Digital stamp | Icon + wordmark + legal entity per approved source; never redraw or guess |

### 02.3 Clear space, size and positioning

- Maintain clear space of **at least 0.5× the cap-height of the wordmark** on each side as a proposed minimum; use the original asset guide if its required clear space is greater.
- Do not place it over busy imagery unless a neutral contrast field makes every stroke readable.
- Proposed desktop header logo visual width: **148-172 px**; mobile: **126-152 px**. Preserve aspect ratio and actual approved SVG proportions.
- Footer may use a more prominent mark. Do not crop the A insert, outer strokes or animation canvas.
- Brand motion may reveal the approved paths with clipping, opacity or masking, **but must not morph, squash, distort or reconstruct any path**. Keep an equally valid static fallback.

### 02.4 Brand red discipline

**`#B43E31` is an accent, not a page-filling theme.** Prefer red for the A insert, primary controlled emphasis, active state, selected route, section identifier, important link and occasional small editorial structural marks. Avoid coloring all CTAs, all icons, all cards and all headings red simultaneously.

### 02.5 Corporate details

Public approved identity: **PT Satu Arah International**, `info@voraworld.id`, **Gedung Nucira, Jl. Letjen M.T. Haryono Kav. 27, Tebet, Jakarta Selatan, DKI Jakarta 12810**. The public experience must not expose a company telephone or WhatsApp number. Contact and RFQ forms may **collect the prospective customer's phone number** where the workflow requires it; collection is different from publishing VORA's own number.

---

## 03. Design tokens and surface palette

### 03.1 Core color system

These are standardized target tokens. Existing CSS currently has overlapping variable families; consolidate without silently changing the approved red and ink.

| Token | Value | Purpose |
|---|---|---|
| `--vora-ink` | `#101720` | Primary ink, dark hero, dark footer, primary controls |
| `--vora-ink-2` | `#1A2430` | Secondary ink surface |
| `--vora-red` | `#B43E31` | Approved brand accent |
| `--vora-red-deep` | `#8F2F25` | Darker red interactive state, not a replacement identity color |
| `--vora-paper` | `#F7F7F4` | Primary page background |
| `--vora-white` | `#FFFFFF` | Elevated clean surface |
| `--vora-bone` | `#ECEAE4` | Sculptural base and secondary warm surface |
| `--vora-silver` | `#E9ECEE` | Cool neutral field |
| `--vora-steel` | `#5D6A75` | Secondary copy on light backgrounds |
| `--vora-line` | `#DCE0E1` | Quiet separators |
| `--vora-dark-line` | `rgba(255,255,255,.16)` | Rules on dark background |
| `--vora-success` | `#276650` | Functional success, not a brand color |
| `--vora-warning` | `#85631E` | Functional warning |
| `--vora-error` | `#A6342A` | Functional error |

**Contrast:** brand red on paper is suitable for many normal-size text applications (approximately 5.3:1); do not assume brand red on deep ink meets normal-text contrast. White, verified accessible neutral, or large nonessential decoration should be used there. Test final rendered states with contrast tooling.

### 03.2 Color distribution, not a formula

Target a **predominantly neutral composition**: paper/bone and white as the main reading surfaces; strategically significant ink regions; limited red. Do not force percentages if the page narrative requires a dark immersive chapter. Use dark-to-light transitions as chapter changes, not alternating stripes every screen.

### 03.3 Surface and material tokens

| Surface | Intended use | Treatment |
|---|---|---|
| `paper` | Copy-first pages, reading sections | Almost flat, warm neutral, crisp rules |
| `museum-plinth` | Sculptural subject or hero | Broad, soft bevel; subtle dual-light; visible contact shadow |
| `satin-panel` | Featured narrative / service proof | Mild gradient, coherent light direction, precise inner edge |
| `recessed-well` | Inputs, diagrams, controlled inset zones | Shallow inner shadow and 1 px boundary |
| `technical-plate` | Data, process diagrams | Low-radius, flat/near-flat, grid/rule clarity |
| `dark-ink-stage` | Selected hero, statement, footer | Depth via lighting/subject, not a stack of black cards |

**One lighting model per composition.** Default key light from upper-left, weak fill from upper-right, contact shadow below/right, ambient occlusion where objects meet the stage. A component's highlights and shadows must agree with that model.

### 03.4 Shadow families

- `shadow-soft`: elevated interface; approximate `0 12px 32px rgba(16,23,32,.08)` plus subtle near-shadow.
- `shadow-contact`: hero illustration and physical stage; tight dark contact directly beneath object plus broad, low-opacity diffusion.
- `shadow-inset`: shallow controls/recessed stage; fine internal dark lower-right and pale upper-left highlights.
- `shadow-focus`: semantic focus ring separate from sculptural lighting.

**No universal `box-shadow` applied indiscriminately to all cards, lists and panels.** More shadows do not equal more depth.

### 03.5 Radius hierarchy

- Technical panels and dense admin cells: `6-12 px`.
- Buttons and inputs: `8-12 px`.
- Editorial image window or art plinth: `18-32 px`, dependent on scale.
- Organic sculptural background forms: custom asymmetric curvature **only in image/stage composition**, not on every UI card.
- Do not use full pills for all navigation and all CTA controls.

---

## 04. Typography system

### 04.1 Fonts

Use **self-hosted Archivo Variable** as the primary visual system where available in the repository (`/static/fonts/archivo-latin-wdth.woff2` is used by the current public site). Preserve font-width controls for expressive large headings. Do not introduce a new webfont just because it looks fashionable. Use system fallbacks and graceful font loading. Use a **restrained monospace** only for technical labels, document references, tracking-like identifiers, data timestamps and numerical metadata, not for long prose.

### 04.2 Proposed responsive type scale

| Role | Desktop target | Mobile target | Line height / behavior |
|---|---|---|---|
| Display / hero | `clamp(3.8rem, 7vw, 7.1rem)` | `clamp(2.65rem, 11vw, 4rem)` | `.94-1.02`; controlled line breaks |
| H1 subpage | `clamp(3rem, 5.8vw, 5.9rem)` | `2.5-3.35rem` | `.98-1.08` |
| H2 editorial | `clamp(2.35rem, 4vw, 4.65rem)` | `2-2.75rem` | `1.02-1.12` |
| H3 | `1.5-2.15rem` | `1.3-1.75rem` | `1.1-1.2` |
| Lead copy | `1.125-1.375rem` | `1.05-1.2rem` | `1.45-1.6` |
| Body copy | `1rem-1.1rem` | `1rem` | `1.55-1.7` |
| Editorial caption | `.78-.875rem` | `.78-.84rem` | `1.4-1.55` |
| Eyebrow | `.7-.8rem` | `.7-.76rem` | tracked uppercase; never replace actual hierarchy |
| Admin body | `.875-1rem` | `.9-1rem` | `1.4-1.55` |

### 04.3 Typographic art direction

Large headings are set with **deliberate width, optical alignment and line grouping**. The display font may stretch its width axis on selected hero lines. A large headline may occupy one-third to one-half of the composition, but cannot collapse the content hierarchy or push all substance below the fold.

Rules:

- Prefer semantic sentence-case headings. Uppercase reserved for short labels/indexes.
- Never automatically translate an English pun or idiom word-for-word to Indonesian. Both are separately art-directed native-language texts.
- Avoid widows, isolated last words and large blocks of centered body text.
- Typical long-copy measure **58-72 characters**; hero support copy **35-52 characters**.
- No six-line mobile hero because the desktop font-size was simply scaled down.
- Set `text-wrap: balance` selectively for display headings, and `overflow-wrap: anywhere` for long URLs, logistics references and admin data.
- Use tabular numerals in financial and operational tables.

---

## 05. Layout foundations and responsive grid

### 05.1 Master containers

- **Wide editorial frame:** max width **1440 px**, with inner content usually **1200-1320 px**.
- **Default site frame:** max width **1280 px**. Break the frame intentionally for full-bleed visual chapters, not as an accidental overflow.
- **Reading column:** max **680-780 px** for long-form content.
- **Technical process diagram:** max **1120-1280 px**; prioritize legibility over decorative empty space.
- **Mobile horizontal inset:** **18-24 px** at 360-430 px viewports; never clip headlines/CTAs to achieve a designed edge.
- **Desktop inset:** `clamp(28px,4.6vw,64px)` where it does not conflict with grid requirements.

### 05.2 Twelve-column editorial grid

Desktop: 12 columns, nominal gutter **20-28 px**. Composition must support deliberate spans **7/5, 8/4, 5/7, 4/8, 9/3, 3/9** and full-width moments. Tablet: six columns or a rational two-column layout. Mobile: four conceptual columns, with most content full-width; cards and narrow UI may form two columns only if truly scannable.

**Grid is a tool, not a cage.** Use controlled overlap, bleeding art and visible baseline anchors when they serve the story. Do not use irregularity randomly.

### 05.3 Vertical rhythm

Proposed section spacing:

- Desktop hero: **88-132 px** top/bottom, adapted to actual header height and hero art.
- Desktop major chapter: **104-164 px**; short subchapter: **64-96 px**.
- Tablet: **72-112 px**.
- Mobile chapter: **60-88 px**; micro-section: **36-56 px**.
- Intro-to-content gap: **36-64 px** desktop, **24-36 px** mobile.

Allow dramatic negative space in strategic places, but not repeated giant empty voids. Every section should have a reason to begin and end.

### 05.4 Visual rhythm recipe

Within a page, alternate **composition types**, not simply colors: monumental heading → asymmetric service plate → full-bleed operational visual → sparse annotated diagram → narrow narrative column → dark material stage → concise RFQ conclusion. No exact recipe should repeat page after page.

Recommended page-level budget: no more than **two consecutive sections** with the same dominant layout grammar; no more than **one hero-grade sculptural animation competing for attention** in the viewport; and at least **one quiet, typography-first chapter** in each major page.

### 05.5 Sticky and fixed UI

The header can be sticky, but must avoid obscuring anchor targets. Use `scroll-margin-top` where necessary. Avoid stacked sticky bars, floating popups and oversized mobile overlays. If a floating inquiry affordance is truly necessary, it must not cover primary content or bottom controls.

---

## 06. Editorial composition grammar

A section must select **one primary composition archetype** and optionally one supporting device. Use the archetypes as a library of editorial decisions, not as identical templated components.

| Archetype | Description | Appropriate usage |
|---|---|---|
| `Monumental Split` | Large text occupies 7/12, engineered 3D object 5/12, asymmetrical baseline | Home hero, selected signature service |
| `Object on Plinth` | Singular believable object on lit tactile base, short side annotations | Distinctive service subject |
| `Typographic Manifesto` | Overscale 2-4 line statement, minimal ornament, one rule | Brand point of view, About |
| `Technical Ledger` | Index, labels, grid lines, short proof/constraints, structured metadata | Customs, routing, service parameters |
| `Operational Triptych` | Three stages with varied image/text proportions, not three uniform cards | Shipment workflow or process |
| `Full-Bleed Environment` | Large photographic/3D logistics environment with editorial overlay | Atmospheric interlude, cargo scope |
| `Asymmetric Gallery` | Unequal media areas, one dominant subject and one small supporting detail | Services and About |
| `Chapter Rail` | Thin vertical/horizontal rule, numbered sections and anchored captions | Detailed long-scroll service pages |
| `Horizontal Process` | Legible route/progress schematic, explicit origin-to-destination meaning | Freight stages, customs workflow |
| `Reference Table` | True structured data, compact labels, sticky header where needed | Network, capability matrix, admin |
| `Quiet Reading` | Narrow column, high-contrast headings, relevant figure/callout | Insights, compliance explanations |
| `Ink Statement` | Dark high-contrast chapter, restrained red key line, strong CTA | Climax and closing moments |

**Card policy:** cards are suitable for interactive choices, grouped peer records, compact related links or admin dashboard units. Cards are **not** the default container for every paragraph. A page whose sections could all be swapped without changing the design fails art direction.

---

## 07. Realistic 3D, clay and neumorphic depth

### 07.1 Object realism

Hero and service 3D art must resemble **premium product visualization**, with physically plausible material roughness, industrial form, real mass, coherent occlusion and believable scale. Aim for sculptural satin surfaces, ceramic/painted metal or matte composite where appropriate. A truck, plane, vessel, container, forklift or crane must remain structurally recognizable and industrially credible.

Do not exaggerate bevels until a freight object becomes a rubber toy. Avoid excessively simplified toy wheels, melted corners, tiny smiling figurines or candy reflections. If the available asset does not meet this threshold, use a clean editorial photo or technical diagram rather than forcing a clay object.

### 07.2 Neumorphism: precision, not blanket treatment

Use relief selectively for **plinths, inset controls, special material panels and micro-interfaces**. Contrast and boundaries remain explicit. The system is **not** pure neumorphism, because pure soft-shadow-only interfaces are often unreadable and undermine operational credibility.

Use depth hierarchy:

1. Neutral canvas: near-flat.
2. Soft editorial panel: slight lift or inset.
3. Featured plinth: clear material volume and contact shadow.
4. Primary sculpture: strongest visual depth.

Do not put a large 3D object, thick border, hard outer shadow, glass layer, gradient and animated glow into the same card.

### 07.3 Asset art direction

Accepted image categories:

- **Hero-grade sculptural 3D** of a specific transport mode or logistics object.
- **Industrial photography** with truthful equipment, ports, warehouses, handling and people where the scene is defensible.
- **Operational/technical diagrams** for service logic.
- **Brand abstraction** using approved A/route geometry, no counterfeit logo paths.
- **Document/process UI captures** only when they reflect actual product behavior and contain safe demonstration data.

Each significant asset should have an **asset ID, subject, page/section, purpose, source file, actual dimensions, format, alpha status, mobile framing, descriptive alt text and usage frequency** in the asset manifest.

### 07.4 Asset reuse and the existing library

The repository contains an `ASSET_MANIFEST.csv` covering selected objects including air/sea integration, airplane, container vessel, warehouse, road freight truck, global cargo and project machinery. **The manifest is a starting point, not a restriction to the previously selected few files.** Audit supplied and already licensed assets, recover eligible source material from the repository or a fresh owner-provided package where available, and use broader subjects where it improves distinctness. Do not claim missing assets exist locally.

Rules:

- Avoid reusing the **same recognisable render** across more than one prominent hero/major section in a site review pass.
- Do not repurpose the same object for contradictory services; e.g., airplane art must not become Project Cargo simply because it fits a frame.
- Use genuine transparent assets when alpha is needed; do not fake cutouts from a contact sheet or low-resolution screenshot.
- Preserve generous negative space in the actual source image; never amputate a crane boom, vessel hull or the object shadow.
- Deliver optimized WebP/AVIF variants as appropriate; keep an auditable source-to-output mapping.
- Mixed photographic and 3D media must still share a consistent warm/cool lighting and color-grade philosophy.

### 07.5 Visual staging

A featured object can sit partly outside its stage, but must remain optically anchored. Provide a **soft contact footprint** and consistent shadow direction. Supporting route lines should be at an appropriate visual z-plane; never intersect or obscure key features of the object. Stage background relief may morph slowly while the object remains structurally unchanged.

---

## 08. Imagery placement and variation

**Image priority by page and context** (art direction targets, not a declaration of already available media):

| Page / subject | Primary visual | Secondary evidence/diagram | Avoid |
|---|---|---|---|
| Home | Air + sea integrated sculpture or strong freight composition | Operational connection, road freight/warehouse detail | Multiple repeated globes |
| International forwarding | Aircraft + container ship, balanced without looking like an icon pair | Shipment legs, handoff logic | Cartoon cargo collage |
| Customs brokerage | Documentation/inspection geometry, refined technical plate | Customs milestones/checklist | Giant shield/checkmark as entire proof |
| 3PL / warehousing | Rack/forklift/warehouse scene with real spatial depth | Inventory flow/fulfilment diagram | Generic parcel pile repeated |
| Domestic distribution | Recognisable truck and freight logistics | Lane / pickup / delivery process | Fake real-time route status |
| Project cargo | Heavy machinery, engineered lift or oversized equipment | Dimensions, engineering stages | False project case study |
| About | One distinctive, editorial brand/environment composition | Principles / credible operating expertise | Fake team photography or fake history |
| Network | Structured geographic data/map with only validated locations | Route category / mode legend | Invented pins across the world |
| Insights | Article-specific editorial illustration/photo | Diagrams and sources | Same site hero recycled as article cover |

**Hero differentiation:** each primary page must have a unique silhouette, crop logic, physical subject, type rhythm and motion signature. Merely changing red to navy does not qualify as a different page design.

---

## 09. Motion design system

### 09.1 Principles

Motion should create a sensation of **mass, spatial continuity, purposeful feedback and brand craftsmanship**. Nothing should appear to move simply because the animation library exists. Motion is a progressive enhancement: navigation, forms, critical copy and documents work with JavaScript/motion disabled.

**Required: motion without scroll-triggered reveal.** Begin selected narrative choreography on route/page mount or when the composition actually enters the application state; do not hide headings or imagery until the visitor scrolls into an `IntersectionObserver`. Hover/focus and user-driven state changes may animate. Ambient sculpture may have long-duration loops where meaningful. Passive scroll position may drive only genuinely useful indicators such as a progress line, never content visibility.

### 09.2 Motion taxonomy

| Layer | Duration target | Movement / behavior |
|---|---|---|
| Press/focus feedback | `80-180 ms` | Tactile offset, focus ring, state change |
| Navigation / dropdown | `180-340 ms` | Controlled opacity + 4-10 px displacement |
| Small item reveal or tab switch | `240-420 ms` | Opacity/translation, no layout jump |
| Editorial first paint | `450-1100 ms` | Restrained masked type, object reveal, route trace |
| Scene change / large composition | `600-1400 ms` | Spatial handoff, careful staging |
| Ambient object movement | `8-24 s` | Small movement: 4-12 px or low-amplitude tilt |
| Ambient organic background morph | `14-30 s` | Very slow relief/shape change |
| Route/orbit geometry | `24-70 s` | Minimal contrast, behind content |
| Loading feedback | `0.7-1.4 s` repeating only while pending | Short and honest feedback |

Recommended easing: `cubic-bezier(.22,1,.36,1)` for arrivals, `cubic-bezier(.2,.8,.2,1)` for interaction. **Do not apply the same float animation to every page asset.**

### 09.3 Page-specific motion signatures

| Page | Primary signature | Supporting motif |
|---|---|---|
| Home | One-time multi-layer editorial arrival, integrated transport subject reveals | Route lines draw in, then settle |
| International | Distinct aerial/sea paths introduced by mode selection | Two transport modes shift focus on tab change |
| Customs | Controlled sequential documentation/clearance markers | A technical seal/rule resolves, not a playful stamp |
| Warehousing | Depth-plane assembly of rack/parcel/forklift space | Inventory cadence via understated pulses |
| Distribution | Horizontal path/dispatch progress with actual steps | Waypoint transition after user selection |
| Project Cargo | Slow heavy-mass lift or engineered parallax | Load geometry lines and caption lock-in |
| About | Editorial typographic reveal, minimal sculpture | Brand A accent light/mask, paths untouched |
| Network | Route highlight from true, selectable data | Map focus between validated nodes |
| Insights | Calm editorial image arrival | Index and line wipe |
| Contact / RFQ | Functional input response and live route summary | Submit-progress and confirmed status |
| Admin | Only purposeful feedback, never decorative autoplay | Row addition, save state, toast, modal |

### 09.4 Remotion and implementation

The current codebase includes **Remotion, `@remotion/player` and `@remotion/paths`**. Reuse these capabilities for signature scenes where frame-accurate timeline composition makes a difference. Prefer CSS for simple hover, feedback and restrained transitions. Heavy Remotion scenes must be client-isolated and lazy-loaded rather than pushing motion runtime into all public routes.

Suggested reusable motion primitives:

- `EditorialReveal`: one-time heading/caption mask, **no path distortion**.
- `RouteTrace`: data-informed curves and nodes with time-based reveal.
- `SculptureStage`: physical object entrance, contact-shadow resolution, subtle ambient movement.
- `ModeChange`: controlled switch between service modes with coherent focus.
- `BrandReveal`: canonical wordmark A insert reveal using masks/opacity, preserves exact source geometry.
- `DocumentStatus`: subtle verified/pending/void state appearance with accessible status text.

Build page-level compositions using **different sequences** instead of copy-pasting one composition and swapping its media. Keep the accessibility/low-motion fallback visible and readable.

### 09.5 Reduced motion and interruptions

`prefers-reduced-motion: reduce` must disable optional scene loops and shorten/remove reveal movement; content should become immediately visible. Transitions must not hijack keyboard focus, interrupt form editing or keep moving when a page is inactive if avoidable. Stop animating a loader immediately after the pending operation resolves. For loops, avoid simultaneous motion across more than two foreground objects in one viewport.

### 09.6 Favicon and brand micro-motion

Favicon support varies by browser and format. Provide a **static canonical favicon as universal fallback**; optional animated SVG can be progressive enhancement where supported. Never make task completion, status or brand recognition dependent on favicon animation. The canonical A geometry remains fixed.

---

## 10. Interaction, controls and feedback

### 10.1 Buttons

Primary action: solid ink or controlled brand red. Secondary: outlined or pale tactile surface. Tertiary: editorial link with a precise underline/arrow. Size targets: minimum **44×44 px** touch target, primary desktop height about **48-54 px**, mobile about **48-56 px**. Provide hover, focus-visible, active, disabled and pending states. **Disabled controls must remain readable** and explain prerequisites when meaningful.

### 10.2 Links and navigation affordances

Links must look interactive without requiring hover; don't rely exclusively on red. Arrows convey direction, not decoration. Avoid making an entire large block clickable unless focus, target and semantics are explicit. Use the native browser cursor; pointer styling is appropriate only on real clickable controls.

### 10.3 Forms

- Labels above fields, permanently visible. Placeholder is supplementary.
- Required/optional indication is explicit. Keep helper text next to the field.
- Errors are field-specific, written as corrective guidance, and announced accessibly.
- Use input types and autocomplete semantics correctly; never block common paste/password manager behavior.
- Group RFQ by **transport mode → origin/destination → shipment details → contact → review/submit**, adjusted to the actual backend contract.
- On mobile, use full-width controls, rational order, and native type-specific keyboards.
- Submission must show real pending/success/failure states. Do not fake completion or display a “success” state before the server confirms it.
- Save/autosave indicators should distinguish **editing, saving, saved, conflict and failed**.

### 10.4 Loading and processing

Use the existing feedback foundation as baseline: in-button spinner, wait-bar when progress cannot be measured, skeleton matching final content geometry, toast, confirm dialog, row reveal and navigation pending feedback. Existing `VoraLoader`/canonical A logo effects can be refined **without changing identity paths**.

Loading design must be honest: percentage only for measured bytes/tasks; indeterminate state for unknown duration. Avoid full-screen branded loaders for minor operations; avoid showing several overlapping spinners for the same request. Reserve layout dimensions to prevent content shift.

### 10.5 Tables and dense information

Numeric fields align consistently; currency uses tabular figures and ISO currency code where ambiguity exists. For 360 px mobile, choose between **horizontal scroll with visible cue** or a purpose-built record summary; do not crush six columns into unreadable 8 px text. Place row actions consistently, separate destructive actions, and keep filters and sort labels explicit. Never hide document status solely through color.

### 10.6 Dialogs, confirmation and notifications

Use modal dialogs for irreversible actions, complex selection or short interruption. Dialog focus must be managed and restored. Confirmation explains exactly what will change. Toasts are for transient outcomes; critical errors must persist near the relevant content. Do not create modal-on-modal chains.

---

## 11. Global navigation and site chrome

### 11.1 Desktop header

A calm, sticky header with canonical brand at left, clear primary navigation, bilingual switch and a focused RFQ/contact action. A mega menu may show the **five verified top-level service groups** and relevant subservices. The menu is information architecture, not a gallery of heavy animations. Keep hover intent, keyboard navigation, Escape behavior and outside-click behavior predictable.

### 11.2 Mobile navigation

Use a proper disclosure/sheet structure, not compressed desktop links. Provide adequate tap spacing, nested service hierarchy, language switch, RFQ access and explicit close. Background page scroll behavior should be controlled when a full overlay is open. Avoid horizontal drift and accidental hidden menu items.

### 11.3 Footer

Editorial footer: large brand statement or mark, concise service navigation, legitimate company details, legal/privacy links, email and address. Brand A/wordmark may use a restrained, optional one-time masked introduction or gentle surrounding ambient composition with **static fallback and no geometry morph**. Footer should feel like the final designed chapter, not an unstyled link dump. Do not expose telephone/WhatsApp or admin route.

---

## 12. Public page experience specifications

### 12.1 Home: flagship editorial sequence

**Target:** strong identity + clear business scope + commercially useful wayfinding.

**Suggested chapters (not a rigid repeated section template):**

1. **Hero:** 7/5 or 8/4 asymmetry; monumental, concise strategic statement; one air/sea logistics sculpture; single dominant CTA to RFQ and an understated service-browse action. Routes/shape arrival is a one-time motion sequence.
2. **Service architecture:** five groups displayed in an **unequal editorial composition**, not five cloned cards. Each has one-sentence operational relevance and link.
3. **Operational chain:** explain cross-mode coordination through an annotated, genuinely intelligible transport handoff diagram or technical plate.
4. **Featured capability:** one image-led, high-depth chapter with distinct subject (road/warehouse/project cargo) and a credible explanation.
5. **Methods and responsibility:** process clarity and scope boundaries, not unverifiable statistics or fake achievement counters.
6. **Insights / practical thinking:** selected real published content with distinct subject imagery, no fake article chronology.
7. **Closing inquiry:** bold dark/neutral signature moment, clear scope of what to submit, short CTA.

Avoid excessive independent homepage sections merely to fill length. Each must progress the buyer's understanding.

### 12.2 Service taxonomy and service-page principles

The **current repository README describes five major service groups**: International Freight Forwarding, Customs Brokerage, 3PL & Warehousing, Domestic Distribution, and Project Cargo, with multiple subservices. The live code should be consulted for the exact route and subservice inventory before edits. Design templates may be shared at the component level, but **hero, page story, diagram and animation must be distinct for each group**.

Every service page should answer, in a logical order: what is handled; when it is the right solution; key cargo/data inputs; the operational sequence; what VORA coordinates; what remains dependent on carriers/authorities/route; and how to inquire.

### 12.3 International Freight Forwarding

**Visual language:** horizon, container geometry, aircraft volume, layered route lines, disciplined two-mode contrast. Distinctive split hero with modes as navigable content, not decorative tabs. Secondary pages for Air Import/Export and Sea Import/Export may use tailored mode/movement variants.

**Content grammar:** mode, Incoterms dependencies, ports/airports, FCL/LCL or chargeable weight basis as applicable, pickup and delivery boundaries, documentation and quote inputs. No invented schedule or transit-time promise.

**Recommended composition:** wide split → small technical mode table → image-led handoff sequence → quiet caveats → RFQ.

### 12.4 Customs Brokerage

**Visual language:** precise paperwork, controlled layers, seals, technical grids, minimal sculptural subject. The animation can sequence valid document stages, not pretend to approve customs clearance.

**Content grammar:** document readiness, HS-code/classification as applicable, customs processes/conditions, import/export scope and responsibilities. Avoid implying any clearance is guaranteed. Use a ledger-like layout, annotated checklists and one tactile documentation stage instead of a generic feature-card grid.

### 12.5 3PL & Warehousing

**Visual language:** believable shelf depth, forklift/cargo arrangement, real spatial hierarchy and subdued lighting. Pair one large warehouse visual with a clean operational flow for receiving, inventory, storage, pick/pack/dispatch as services actually offered.

**Content grammar:** inventory units, inbound/outbound data, stock visibility, handling limitations, storage specifics and commercial prerequisites. Do not claim a proprietary WMS or footprint unless verified.

### 12.6 Domestic Distribution

**Visual language:** horizontal movement, truck scale, route geometry and dispatch rhythm. Distinct editorial layout: route/lane diagram, cargo mode matrix, warehouse/dispatch supporting shot.

**Content grammar:** FTL/LTL and other supported domestic modes, cargo constraints, pickup/delivery input requirements, service area dependent on confirmed coverage, SLA quoted by lane not fabricated sitewide.

### 12.7 Project Cargo

**Visual language:** mass, gravity, heavy equipment, engineering precision, oversized dimensional annotations. Use one dominant realistic heavy-cargo composition, wider frame and deliberately slower motion; this page should feel heavier and more technical than the others.

**Content grammar:** dimensions, weight, center of gravity where relevant, lifting/handling concept, survey and route assessment, equipment selection, permits and feasibility dependencies, packaging and risk handling. Do not publish made-up projects, tonnage or execution footage as completed case studies.

### 12.8 About

**Narrative:** brand philosophy and operational method, not fictional origin mythology. Typography-led introduction; one distinctive environment/brand sculpture; a limited, substantive sequence showing how VORA thinks about cargo, coordination and accountability. If the company has no approved historical milestones, **omit the timeline**. Do not invent team headshots or an executive board.

### 12.9 Solutions and industries

Use **industry-specific bands** or alternating composition archetypes, with genuine differences in cargo characteristics and constraints. Avoid identical three-card blocks for every industry. Content should not claim licensed/hazardous/temperature-controlled expertise without supporting operating capability. Allow details/accordion on mobile, but desktop readability must not depend on unnecessary clicking.

### 12.10 Network / coverage

A useful map or route representation must use **validated coverage data**. Differentiate *direct execution, partner-served, on-request and unavailable* if those statuses are actually maintained; do not invent a global pin cloud. Include mode legend, relevant origin/destination language and clear uncertainty. Preserve keyboard alternatives and readable list fallback for interactive visuals.

### 12.11 Insights / articles

Editorial publication design, not a card catalog pretending to be a news site. Use differentiated featured-article cover and a typographic archive list. Article content: readable measure, clean headings, figures with captions, author/date truthfulness, sources where required, article-specific thumbnails and native ID/EN versions. Editorial schedule/archive dates must not be falsely shown as actual historic publication dates.

### 12.12 Contact and RFQ

This is a **commercial task**, not a decorative 3D showcase. Lead with clarity. Use an intelligently grouped form with a subtle route-summary plate, shipment context, privacy explanation and a clear submission outcome. Decorative objects must not compete with field labels. Contact details display the approved company email and address only; prospect phone input may be required.

### 12.13 Legal, privacy, FAQ, 404

Reading-first, restrained and accessible. No gratuitous animation on legal pages. FAQ uses meaningful groups and concise answers, readable closed/open state and keyboard-friendly summary. A custom 404 may carry brand character through a controlled geometric motif, but the route back to navigation must be clear.

---

## 13. Admin/business portal design

### 13.1 Separate visual mode, shared identity

Admin UI must be **precise, fast, information-dense and calm**. It shares fonts, identity colors, focus conventions and feedback primitives with the public site, but **does not inherit decorative public-page composition**. No oversized editorial headings where operators need to process records. Use desktop side navigation grouped by existing Sales, Finance, Website and System domains; a practical mobile navigation alternative.

### 13.2 Global admin layout

- Desktop sidebar approx **232-264 px**, adjustable by implementation constraints; content width flexible with useful max width for forms.
- Dense table pages can use nearly the full available width.
- Page title with short context at top, primary action in a predictable position, secondary actions restrained.
- Search, filter, status and export tools form a coherent toolbar; no arbitrary cards for every filter.
- Avoid horizontal scrolling of entire admin shell. If a table requires scroll, **only that table** scrolls.
- Preserve breadcrumbs/context on deeply nested workflows. Distinguish draft, issued, awaiting approval, approved by customer, validated, rejected, void, pending payment and cleared status where applicable to real state machines.

### 13.3 Admin component language

Use restrained panels, short section titles, form subheadings, minimal 1 px rules, clear empty states and semantic feedback. Status chips may encode state but must include explicit text and accessible contrast. Financial totals are aligned consistently. Input tables must be true editable tables, not rows serialized into a pipe-separated string.

### 13.4 CRM: leads and customers

A lead can become a customer where supported; customer records should keep PIC name, PIC phone, organization details and context. The interaction must show selected account and maintain referential clarity. Contact info in the **private admin** may exist without violating the ban on VORA's public phone/WhatsApp details.

### 13.5 Quotation approval

Use an explicit workflow and visual status timeline:

`Draft → Issued / Awaiting Approval → Customer Submitted Signed PDF → Admin Validated (or Rejected)`.

**Customer submission and VORA validation must never look like the same status.** The UI should distinguish uploaded evidence from completed legal/commercial validation. All documents use actual, server-backed status; no front-end-only state simulation. Quotation items are editable line rows with amount summaries and a clear preview.

### 13.6 Delivery notes and mobile POD

A delivery note should present sender/recipient information, quotation relationship, cargo details and relevant dates clearly. Mobile POD is task-first: driver identity, receiver identity/position, signature surface, photos, location/permission state, review and final submit. Allow signed strokes to appear immediately in the preview on mobile; no disappearing drag/drop overlay. Explain why location permission is needed and show recovery when denied. Distinguish **data not saved**, **upload in progress** and **proof successfully submitted**.

### 13.7 Invoice, payment and receipt

Document workflows must be operationally readable: current status, invoice-linked delivery notes, totals, outstanding balance, payment confirmation and receipt status. **Pending payment claims must not appear as cleared funds.** Display verification status, e-meterai requirement and document-release prerequisite when applicable. Multiple company bank accounts are displayed as readable snapshot blocks in documents, never random icon tiles.

### 13.8 CMS / page builder

CMS is a production tool, not a mock visual builder. A section editor should identify: template/archetype, content fields, media ID, layout variant, light/dark theme, section order, language completeness, SEO and preview state. Provide meaningful live/staging preview when feasible, with desktop/tablet/mobile choices. Do not permit arbitrary one-off styling that breaks global tokens unless explicitly approved.

### 13.9 Email template manager

Present template **subject, sender context, recipient type, editable HTML body, variables, preview and send-state/retry behavior**. Show a real rendered sample from the actual sanitization pipeline and prevent dangerous or unsupported markup. Avoid making operators edit HTML blind if preview is available. Labels must distinguish draft, test and actual send.

### 13.10 Admin microinteractions

Only operational motion: button pending spinner, progress bar for measured upload, skeleton, row added highlight, unobtrusive toast, confirmation dialog, focus transitions, save-status indicator and navigation pending line. Decorative looping sculptures belong to public narrative pages, **not** busy admin workspaces.

---

## 14. Documents, verification and digital stamp system

### 14.1 Design language

Financial and commercial PDF artifacts need a separate **official document design mode**: A4, strongly structured details, correct canonical logo, `#101720` ink, `#B43E31` accent, meaningful watermark and consistent monospace identifiers. Document authenticity, complete financial data and legibility outrank visual flourish. **Do not remove fields to make a page prettier.**

### 14.2 Verified document layouts

The document system covers quotation, delivery note/POD, invoice, prepayment/receipt, verification and any approved statement/letter. Retain distinct process requirements. Important invoice constraints from the existing repository include a limit of **five charge items per A4 invoice page** and bank/payment data on appropriate pages, subject to current implementation verification before editing.

### 14.3 QR and signature block

For brand-level signature/verification templates, follow the owner's approved geometry:

- Two signature-style design variants with the same **2:4 width:height proportion**, compact, professional and aligned; one for VORA-issued documents, one for third-party/partnership documents requiring a directly clickable verification link.
- QR and explanatory area should have **equal visual height**, with consistent top/bottom baselines.
- Where a signature variant carries a clickable verification link, place it **below the QR and explanatory content** rather than stretching the entire unit full-width.
- Brand red is used for the clickable verification link; avoid line truncation and wrap long URLs safely.
- The document footer is a distinct full-width component for non-agreement documents and must **preserve all original footer information** while rearranging its layout.
- Verification page may use a repeated, low-contrast watermark of the **approved A icon + wordmark + legal entity**. It must not impair the status and verification information.

### 14.4 Trust and legal semantics

A QR URL must display **verified system record status and limited appropriate metadata**, not pretend that a QR by itself is a qualified electronic signature or cryptographic proof of every PDF field. If document-digest attestation/signature validation is implemented, its claims must match the **actual verification mechanism** and the deployed key management. Never write “tamper-proof”, “government-approved signature” or similar labels without substantiation.

### 14.5 Redaction and privacy

Public verification pages must not disclose private customer identity, commercial rates, bank details or unauthorized document content. Provide status states (valid/current, revoked, unavailable, pending) in words, not color alone. Use `noindex` and appropriate security/privacy handling already in the codebase; do not weaken existing validation routes to support animation.

---

## 15. Responsive design and mobile behavior

### 15.1 Required viewport matrix

Review **320, 360, 390, 430, 768, 1024, 1280, 1440 and 1920 px**. Primary visual sign-off must explicitly include **360/390 mobile** and **1440/1920 desktop**. Test both English and Indonesian for critical public pages; test admin at **360/390/768/1440**. These are test widths, not a demand for separate static breakpoints everywhere.

### 15.2 Mobile is an art-directed format

Mobile is **not** the desktop grid stacked automatically. Rebalance headline line breaks, image focal point, surface depth, narrative sequence, typographic scale and primary CTA hierarchy. For a sculptural hero, display the complete object or a deliberately art-directed crop with credible shadow; never simply shrink a wide desktop render to a tiny centered thumbnail.

### 15.3 Responsive mechanics

- Horizontal overflow of the page is a release blocker.
- Use `min-width:0` on grid/flex children and explicit responsive image sizing.
- Use `clamp()` for type/spacing when useful, not as an excuse to skip 360 px checks.
- Avoid multi-column body copy at mobile widths.
- Touch controls: minimum 44 px interactive target; safe bottom padding where device UI overlaps.
- Sticky header and open mobile menu must not trap scroll or bury focus.
- Off-canvas menu navigation must remain accessible to keyboard and assistive technology.
- Mobile image height should respect content and viewport, not force a giant empty stage.
- Animation must not cause layout shift or trap interaction on slow devices.

### 15.4 Language sensitivity

Indonesian headings may be longer or differently structured than English. The responsive design must handle **native content variance**, not only its English screenshot. Use manual/copy-driven line break control sparingly, never hard-code line breaks that destroy a mobile locale.

---

## 16. Accessibility and usability gates

Target **WCAG 2.2 AA** for public pages and admin workflows, with at minimum:

- Semantic heading order and proper landmark regions; one meaningful H1 per document/page.
- Keyboard-accessible navigation, dropdowns, tabs, dialogs, carousels and form elements.
- Clearly visible focus (not shadow-only) and predictable focus return from dialogs.
- Contrast at least **4.5:1 for normal text**, **3:1 for large text and meaningful non-text controls**, unless a recognized exception applies.
- Images with contextually useful alt text, decorative images marked decorative; no SEO keyword-stuffed alt text.
- Functional text alternatives to diagrams, maps and motion; no critical information available only by color/animation.
- Error messages linked to fields, announced validation results and persistent critical errors.
- User-controlled/reduced motion; no essential animation for form completion.
- No autoplay audio. Avoid blinking/rapid flashing. Do not use placeholder-only labels.
- Readable zoom to 200%+ and text reflow to 320 CSS px without loss of core functionality.

Accessibility is a **design input**, not a patch pass after a gallery of visuals is approved.

---

## 17. Content design, bilingual tone and evidence

### 17.1 Writing voice

VORA copy should sound **experienced, precise, international and operationally literate**. It should explain decisions, handoffs, constraints and buyer inputs in natural language, not just claim to be “seamless”, “innovative”, “world-class” or “end-to-end” on every page.

### 17.2 Proof model

For a capability claim, provide one of: a truthful process explanation, a specific input/output requirement, a documented operating boundary, an approved verified example, or a clearly identified customer benefit without invented metrics. **Technical accuracy is not equivalent to inventing a historical track record.** Practical know-how may inform strong content without attributing unapproved work, clients or results to VORA.

### 17.3 Native bilingual writing

English and Indonesian are **two native editorial versions**, not direct mechanical translations. Preserve meaning and technical accuracy but adapt syntax, logistics terminology and rhetorical rhythm. Retain globally used operational terms (FCL, LCL, AWB, B/L, Incoterms, RFQ, 3PL) where natural. Avoid awkward Indonesian translations of established industry terminology.

### 17.4 No counterfeit evidence

Do not fabricate: completed case studies, customer photos, client identities/logos, shipping network, fleet/warehouse ownership, certifications, years in operation, project value, SLA achievements, measured lead times, response times or public service regions. If the asset is conceptual, presentation must not imply it is a photograph of an actual VORA shipment.

---

## 18. SEO, semantics and CMS resilience

Design and engineering must support real server-rendered copy, structured meaningful headings, internal links, canonical locale routing, responsive metadata imagery and valid alt text. Existing Next.js server-rendered bilingual architecture and SEO settings should remain intact.

CMS content must not collapse the editorial design when copy length changes. Each reusable section should define acceptable character/line ranges, image ratios, mobile fallback, content validation and safe empty states. **Do not encode all art direction in hard-coded homepage HTML while leaving CMS sections ungoverned.** Create a controlled catalog of section archetypes and variants that editors can safely use.

Blog/article dates and archives must reflect truthful publication metadata; editorial scheduling is a separate field when needed.

---

## 19. Performance and implementation limits

### 19.1 Performance targets

Treat these as **acceptance targets, not claimed current scores**:

- LCP target **≤ 2.5 s** at the 75th percentile on representative mobile traffic.
- CLS target **≤ 0.1**.
- INP target **≤ 200 ms**.
- Avoid blocking page content on optional 3D animation or Remotion playback.
- Keep primary hero media compressed and responsive with appropriate dimensions and priority.
- Self-host and preload only truly critical fonts; avoid duplicate font stacks competing across CSS files.

### 19.2 Runtime discipline

Use the existing **Next.js 15 App Router + React 19 + TypeScript + Supabase + Vercel** architecture. Maintain rendering separation: server-first content and forms; client components only for necessary interactivity, motion and rich input. Remotion compositions should not force client hydration across the entire public site. Reuse existing tested flows and route contracts.

### 19.3 Image/media handling

Use source-appropriate `sizes`, accurate dimensions, lazy loading below the fold, proper formats and alpha handling. Where transparency is essential to the sculpture stage, verify that conversion has not introduced a box/halo. Long-running ambient loops must not materially degrade mobile responsiveness or battery life. Provide static hero fallback for slow or low-motion devices.

### 19.4 CSS and token consolidation

Current codebase review found multiple styling layers, including:

- `public/static/css/site.css` (legacy/global styles including public and admin bases)
- `public/static/css/vora.css` (current public art direction and Archivo setup)
- `public/static/css/motion.css` (motion definitions)
- `public/static/css/feedback.css` (processing and UI response)
- `public/static/css/admin.css` (admin refinements)

**Do not add a sixth broad stylesheet of arbitrary overrides.** Instead audit specificities, determine which routes load which files, centralize tokens, phase out duplicate selectors and ensure public/admin isolation. Do not delete seemingly legacy CSS until all affected paths and PDF/verification screens pass regression tests.

---

## 20. Proposed component and design-code architecture

This is a **recommended target organization**, not a claim these exact folders already exist:

```text
src/
  design/
    tokens.ts                 # typed semantic tokens, only if useful
    compositions.ts           # controlled section archetype registry
    motion.ts                 # timings, easing, reduced-motion contract
  components/
    brand/                    # only imports official SVG assets
    site/
      chrome/                 # header, nav, footer, locale
      editorial/              # grids, chapters, annotated media, plates
      sculpture/              # stage, object media, contact shadows
      service/                # modes, route diagrams, service chapter blocks
      forms/                  # RFQ/contact composable fields
    feedback/                 # reuse actual existing behavior/components
    admin/
      shell/                  # navigation, toolbar, action header
      tables/                 # data grid, items editor, status
      forms/                  # complex admin workflows
      documents/              # previews, QR, signature UI
public/static/
  assets/                     # canonical approved brand and optimized media
  fonts/
  css/                        # route-scoped style layers and tokens
```

Component contracts should include: semantic role, data inputs, expected image aspect ratios, locale behavior, loading and error state, responsive behavior, motion signature (if any), reduced-motion behavior, and accessibility tests.

### 20.1 CSS token example

**Illustrative refactor target; adapt names to existing selectors rather than blindly duplicating them:**

```css
:root {
  --vora-ink: #101720;
  --vora-ink-2: #1a2430;
  --vora-red: #b43e31;
  --vora-red-deep: #8f2f25;
  --vora-paper: #f7f7f4;
  --vora-bone: #eceae4;
  --vora-steel: #5d6a75;
  --vora-line: #dce0e1;
  --vora-wrap: 1280px;
  --vora-gutter: clamp(18px, 4.6vw, 64px);
  --vora-ease: cubic-bezier(.22, 1, .36, 1);
  --vora-motion-quick: 180ms;
  --vora-motion-ui: 280ms;
  --vora-motion-intro: 780ms;
}

.vora-container {
  width: min(calc(100% - 2 * var(--vora-gutter)), var(--vora-wrap));
  margin-inline: auto;
}

.vora-editorial-grid {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: clamp(16px, 2vw, 28px);
}

@media (max-width: 900px) {
  .vora-editorial-grid { grid-template-columns: repeat(6, minmax(0, 1fr)); }
}
@media (max-width: 600px) {
  .vora-editorial-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}

@media (prefers-reduced-motion: reduce) {
  .vora-ambient, .vora-scene-intro { animation: none !important; }
  .vora-scene-intro { opacity: 1 !important; transform: none !important; }
}
```

### 20.2 CMS section schema example

Recommended conceptual contract (adjust to existing database and editor model):

```ts
type EditorialSection = {
  id: string;
  kind:
    | 'monumental-split'
    | 'object-plinth'
    | 'technical-ledger'
    | 'operational-triptych'
    | 'full-bleed-environment'
    | 'quiet-reading'
    | 'ink-statement';
  theme: 'paper' | 'white' | 'bone' | 'ink';
  layoutVariant: string; // controlled enum by kind, not arbitrary class names
  content: { en: SectionCopy; id: SectionCopy };
  media?: { assetId: string; alt: { en: string; id: string }; focalPoint?: string };
  motion?: 'none' | 'editorial-intro' | 'route-trace' | 'sculpture-stage';
};
```

This is **not a migration instruction**. Adapt carefully to the CMS current schema; avoid breaking existing published sections.

---

## 21. Design review and quality gates

### 21.1 Visual review matrix

Every primary public page must be inspected at **1440, 1920, 390 and 360 px** in English and Indonesian where the route exists. Additionally validate intermediate 768 and 1024 widths, at least one 320 px stress case, and browser zoom/reflow. Inspect **real screenshots**, not only DOM or CSS assertions.

Review:

- Hero distinctive from every other hero, layout clearly composed.
- Logo and red insert exact, clear and never cropped.
- Hierarchy readable in first viewport; no filler content.
- At least one genuine editorial non-card composition per major page.
- 3D subject realistic, physically anchored and correctly lit.
- Assets not visibly duplicated or low resolution.
- Mobile image crop, text rhythm and actions art-directed.
- No content overlap, clipped URL, horizontal overflow or dead buttons.
- Motion distinct, subtle, functional, accessible and not scroll-reveal dependent.
- Admin flows complete without layout regressions.
- Locale-specific text not broken or awkwardly literal.

### 21.2 Functional test matrix

Run the repository's existing typecheck, unit/integration, HTTP/E2E and **Playwright visual** suites as relevant. Add screenshots for all major public pages and representative admin workflows. Check focused/hover/disabled/loading/error states, media fallback and reduced motion. Validate signing/POD capture on an actual mobile browser or reliable browser device emulation, including preview rendering and touch interactions.

### 21.3 Screenshot evidence and reporting

A design implementation report should include: change summary by page; exact components/styles changed; screenshots at key widths; media/asset inventory and source; motion preview or recording for changed scenes; accessibility/performance test results; and known compromises. **No “complete” claim without visible checks.** Build passing is necessary but does not certify art direction or real-world production readiness.

### 21.4 Scored design review

Score each category **0-5** and require **≥ 4 in each**, not just a high average:

| Dimension | 5/5 definition |
|---|---|
| Brand fidelity | Exact canonical assets and coherent color/typography |
| Editorial distinctness | Page-specific designed compositions with excellent hierarchy |
| Material realism | Believable depth, mass, light and shadow; no toy aesthetic |
| Operational credibility | Specific, truthful and useful logistics information |
| Motion maturity | Different page signatures, controlled pacing, accessibility |
| Mobile craftsmanship | 360/390 px re-composed, not just squeezed |
| Interaction clarity | Navigable, understandable, complete states |
| Implementation integrity | Existing workflows, SSR, SEO, performance and data safety intact |

### 21.5 Automatic failure conditions

Any one of the following blocks visual sign-off: broken logo geometry; invented client/operational proof; inaccessible core action; hidden-on-scroll content; horizontal page overflow at 360/390 px; unreadable type/contrast; animated admin blocking task completion; missing mobile POD signature preview; broken document verification; or a site-wide card-template repetition that overwhelms the editorial design.

---

## 22. Implementation sequence: avoid redesign regressions

### Phase A : Inventory and baseline

Read existing pages, content, loaded CSS, hero/components, official SVG/asset variants, existing `ASSET_MANIFEST.csv`, CMS schema and workflow routes. Capture baseline screenshots at 360/390/768/1440/1920 px. Confirm service taxonomy from route/content data. Note which design rules are already satisfied versus missing.

### Phase B : Tokens and shared foundation

Consolidate colors, typography, grid, containers, surfaces, focus/feedback and responsive baseline. Preserve route behavior and identity geometry. Replace duplicate CSS carefully. Verify both locales and admin shell.

### Phase C : Flagship visual system

Implement a unique Home composition and one reference service page with exact hero depth/lighting, editorial rhythm and calibrated motion. Review real mobile and desktop outputs before scaling the system. Do not mass-generate all service pages from a generic shared template.

### Phase D : Page differentiation and CMS governance

Art-direct each service and supporting public page using distinct composition/motion signatures. Integrate actual assets and managed media. Register controlled editorial section types in CMS without breaking existing published content.

### Phase E : Admin, documents and feedback

Refine dense business workflows, mobile POD, interactive document previews, signatures, verified status and approved QR/footer layouts. Keep legal/security semantics and data contracts intact.

### Phase F : Regression and release gate

Run typecheck, build, test suites, keyboard/accessibility checks, performance sampling and screenshot review. Confirm actual content, both locales and each major viewport. Fix visual and behavioral defects rather than appending untracked CSS overrides.

---

## 23. Final acceptance contract for implementers

An implementation can be considered aligned with VORA only if it demonstrates all of the following:

1. The exact owner-approved logo, A icon, curved red insert and brand colors are preserved.
2. The site feels **architectural, sculptural, editorial and premium**, not like a generic corporate template.
3. Realistic 3D assets have controlled material depth, contact shadows and differentiated usage.
4. Primary pages have **different layouts, hero silhouettes and motion grammar**, not just different headings.
5. Motion is meaningful, page-specific, non-blocking and **does not require scrolling to reveal content**.
6. Mobile at 360/390 px is deliberately composed, with no clipping or broken touch interactions.
7. Copy is native in English/Indonesian, technically precise and free from fabricated proof.
8. The admin portal remains efficient, complete and truthful about states.
9. Document, signature, QR, verification, payment and POD workflows preserve actual security/business semantics.
10. The Next.js/React/TypeScript/Supabase codebase remains intact, with measurable performance and accessible UX.
11. A before/after screenshot matrix and functional checks substantiate the claimed results.

**Operating rule:** When a decorative effect conflicts with readability, truth, performance or operational correctness, the decoration loses. When bland functional UI conflicts with the established premium editorial identity, redesign the composition intelligently instead of accepting a stock template.

---

## Appendix A. Repository evidence consulted (2 November 2026)

This revision is informed by direct reads of the connected GitHub repository `assujiar/voraworld.id` on its default `main` branch, including:

- `package.json` : Next.js 15.5.28, React 19.1.10, TypeScript 5.9.3, Remotion 4.0.539, Supabase and visual-test tooling.
- `README.md` : site/admin/document scope, route conventions, approved public details and asset identity rules.
- `src/app/(site)/[locale]/layout.tsx` : current site-loaded CSS, font preload and bilingual layout structure.
- `src/app/(admin)/layout.tsx` : admin CSS layers and root layout.
- `public/static/css/site.css` : base styles, legacy admin/public style definitions and responsive rules.
- `public/static/css/vora.css` : contemporary public typography, art direction and surface styling.
- `public/static/css/motion.css` : existing motion primitives, timings and reduced-motion rules.
- `public/static/css/feedback.css` : loaders, upload/processing feedback, signature UI styles and navigation feedback.
- `public/static/css/admin.css` : current narrow admin refinements.
- `ASSET_MANIFEST.csv` : selected/excluded source illustration inventory.
- `FINANCE_DOCUMENT_DESIGN_AND_SECURITY.md` : document design, data integrity and QR authenticity limitations.

**Verification limits:** `design.md`/`DESIGN.md` did not exist at the repository root or `docs/` paths checked. The public production URL was not retrievable by the available web fetch during this preparation; therefore this specification does **not** claim pixel-level verification of the live deployment. UI implementation must be audited in the browser before release. This file is a **new master revision** intended to become the design authority, not a claim that the deployed website already matches it.

## Appendix B. Design decision log

| Decision | Rationale |
|---|---|
| Prioritize selective premium depth | Stronger physical realism without unreadable blanket-neumorphism |
| Distinct page compositions | Prevent repeated SaaS/card-template appearance |
| Preserve source SVG geometry | Prevent corrupted VORA identity and incorrect standalone icon |
| Use Archivo Variable | Preserve existing loaded typography and expressive width control |
| No scroll-triggered reveal | Meet established owner preference and keep content immediately accessible |
| Scope Remotion to signature scenes | Deliver cinematic motion without unnecessary runtime weight |
| Separate public/editorial and admin/operational modes | Support visual ambition and business productivity simultaneously |
| Native bilingual content | Avoid unnatural literal translation and layout failures |
| Truthful operational proof | Make B2B credibility defensible, not decorative |
| Test actual 360/390 and 1440/1920 screens | Prevent attractive desktop mockups that fail in real use |

**End of design standard.**

## 24. Complete navigation page preview atlas

**Design coverage (verified against `src/content/site.json`, `src/content/index.ts`, `src/components/site/HeaderNav.tsx`, and `src/server/site.ts`):** 7 default desktop navbar entries; the Services mega menu exposes 5 service categories and 9 nested detail destinations. The brand homepage and the primary `Request a Quote` CTA are also included. That creates **23 public navigation destinations**. The Admin Portal, Privacy and Terms previews are supplementary, bringing the visual atlas to **26 pages**.

Every item below includes two real browser-rendered layout study images. The previews are deliberate design proposals, not captures of live VORA pages. They show the hierarchy, grid, relative scaling, page atmosphere, navigation placement, first content sequence and mobile composition. **3D objects are technical art placeholders, not final VORA production assets.** Replace placeholder figures with approved realistic 3D assets with authentic lighting, material depth and sufficient resolution. The official logo from the repository must replace all typographic mockup wordmarks during implementation. Do not trace or approximate the protected brand mark.

**Preview options:** Open `VORA_All_Pages_Preview.html` for all 26 pages, with a navigation selector and responsive layout. Open the ZIP distribution so that the relative PNG links in this Markdown file resolve correctly. The PDF embeds the same browser renders in its appendix.

### 24.1 Navbar and route coverage

| Navigation area | Required page previews | Coverage |
|---|---|---|
| Home / brand | Home | 1 |
| About | About | 1 |
| Services | Services directory, 5 category pages, 9 service detail pages | 15 |
| Solutions | Solutions | 1 |
| Network | Network | 1 |
| Insights | Insights | 1 |
| FAQ | FAQ | 1 |
| Contact | Contact | 1 |
| Primary CTA | Request a Quote | 1 |
| Supplementary | Admin Portal, Privacy, Terms | 3 |
| **Total** | **Every default public navigation destination and three supplements** | **26** |

#### Mandatory approval rule

An existing, future, CMS-managed or newly introduced navbar item cannot be published without a page-level design specification and responsive visual preview. If CMS navigation differs from repository defaults, generate the missing previews for the actual published routes. A duplicate header or generic copied hero does not satisfy this requirement.
### 24.2. Home (`/`)

**Navigation group:** Core. **Page grammar:** flagship. **Primary design move:** Start from a decisive editorial claim.

**Desktop composition:** Flagship two-field composition. Large text block left, cargo sculpture right, then a full-width service index. Create a distinctly VORA opening, then non-repetitive service and operating sections.

**First visible content:** A true page-specific hero headed "Complex cargo. Clear direction.". The first content band is organized around **International movement**, **Domestic distribution**, and **Operational decisions**. Replace sample prose with verified company-specific detail while keeping the visual structure.

**Mobile direction:** Recompose to one clear primary reading order. Headline must remain legible at 360px/390px, the 3D subject must be visible without horizontal overflow and action controls must remain reachable. Do not merely squeeze the desktop 12-column grid.

**Motion and behavior:** Hero morph + route line with separate durations, no scroll activation. Provide reduced-motion static alternatives. Preserve the existing route behavior, validation and data integration.

![Desktop page design study, Home](layout_previews/01_home_desktop.png)

![Mobile page design study, Home](layout_previews/01_home_mobile.png)

### 24.3. About (`/about`)

**Navigation group:** Core. **Page grammar:** manifesto. **Primary design move:** Company narrative without invented history.

**Desktop composition:** Oversized editorial statement, architectural scene and a horizontal operational principles rail. Separate founder expertise, company capability and current capacity transparently.

**First visible content:** A true page-specific hero headed "Built on movement. Defined by decisions.". The first content band is organized around **What we believe**, **How we work**, and **Operating principles**. Replace sample prose with verified company-specific detail while keeping the visual structure.

**Mobile direction:** Recompose to one clear primary reading order. Headline must remain legible at 360px/390px, the 3D subject must be visible without horizontal overflow and action controls must remain reachable. Do not merely squeeze the desktop 12-column grid.

**Motion and behavior:** Architectural relief reveal on entry; never animate the logo geometry. Provide reduced-motion static alternatives. Preserve the existing route behavior, validation and data integration.

![Desktop page design study, About](layout_previews/02_about_desktop.png)

![Mobile page design study, About](layout_previews/02_about_mobile.png)

### 24.4. All Services (`/services`)

**Navigation group:** Services. **Page grammar:** directory. **Primary design move:** All Services should have its own first-screen information hierarchy.

**Desktop composition:** Typography-led directory with five ruled editorial entries and no repetitive card grid. Typography-led directory with five ruled editorial entries and no repetitive card grid.

**First visible content:** A true page-specific hero headed "Five disciplines. One clear direction.". The first content band is organized around **International forwarding**, **Customs and 3PL**, and **Domestic and project cargo**. Replace sample prose with verified company-specific detail while keeping the visual structure.

**Mobile direction:** Recompose to one clear primary reading order. Headline must remain legible at 360px/390px, the 3D subject must be visible without horizontal overflow and action controls must remain reachable. Do not merely squeeze the desktop 12-column grid.

**Motion and behavior:** Use a single deliberate page-entry movement plus direct interaction feedback; no scroll reveal. Provide reduced-motion static alternatives. Preserve the existing route behavior, validation and data integration.

![Desktop page design study, All Services](layout_previews/03_services_desktop.png)

![Mobile page design study, All Services](layout_previews/03_services_mobile.png)

### 24.5. International Freight Forwarding (`/services/international-freight-forwarding`)

**Navigation group:** Services. **Page grammar:** freight. **Primary design move:** Air and sea journeys are visibly differentiated.

**Desktop composition:** Dark, cinematic cargo-stage with a vessel sculpt and an operational handover strip. Differentiated air and sea modules lead to their own detail pages. Keep two route rail patterns that lead to each of the four mode pages.

**First visible content:** A true page-specific hero headed "Beyond the port. Beyond the flight.". The first content band is organized around **Air import / export**, **Sea import / export**, and **Shipment coordination**. Replace sample prose with verified company-specific detail while keeping the visual structure.

**Mobile direction:** Recompose to one clear primary reading order. Headline must remain legible at 360px/390px, the 3D subject must be visible without horizontal overflow and action controls must remain reachable. Do not merely squeeze the desktop 12-column grid.

**Motion and behavior:** A slow cargo-stage motion, with fixed typography. Provide reduced-motion static alternatives. Preserve the existing route behavior, validation and data integration.

![Desktop page design study, International Freight Forwarding](layout_previews/04_freight_desktop.png)

![Mobile page design study, International Freight Forwarding](layout_previews/04_freight_mobile.png)

### 24.6. Air Import (`/services/international-freight-forwarding/air-import`)

**Navigation group:** International Freight. **Page grammar:** air. **Primary design move:** Flight window before decorative route map.

**Desktop composition:** Inbound air route concept. Aircraft relief with a three-stage handover sequence and a technical import-information block. Use vertical checkpoints for cargo-ready, booked, arrived, released.

**First visible content:** A true page-specific hero headed "Clear the distance. Keep control.". The first content band is organized around **Origin handover**, **Flight and customs**, and **Release and delivery**. Replace sample prose with verified company-specific detail while keeping the visual structure.

**Mobile direction:** Recompose to one clear primary reading order. Headline must remain legible at 360px/390px, the 3D subject must be visible without horizontal overflow and action controls must remain reachable. Do not merely squeeze the desktop 12-column grid.

**Motion and behavior:** Plane glides into place at page load; milestone digits settle once. Provide reduced-motion static alternatives. Preserve the existing route behavior, validation and data integration.

![Desktop page design study, Air Import](layout_previews/05_air-import_desktop.png)

![Mobile page design study, Air Import](layout_previews/05_air-import_mobile.png)

### 24.7. Sea Import (`/services/international-freight-forwarding/sea-import`)

**Navigation group:** International Freight. **Page grammar:** sea. **Primary design move:** Vessel and arrival data in separate functional zones.

**Desktop composition:** Inbound ocean movement. Shipment milestone rail and container-vessel diagram, with port-to-delivery control emphasized. Use import port, customs and truck release as distinct numbered movements.

**First visible content:** A true page-specific hero headed "From vessel arrival to delivery readiness.". The first content band is organized around **Origin documentation**, **ETA and port steps**, and **Release and delivery**. Replace sample prose with verified company-specific detail while keeping the visual structure.

**Mobile direction:** Recompose to one clear primary reading order. Headline must remain legible at 360px/390px, the 3D subject must be visible without horizontal overflow and action controls must remain reachable. Do not merely squeeze the desktop 12-column grid.

**Motion and behavior:** Container stack parallax is time-based, never scroll-triggered. Provide reduced-motion static alternatives. Preserve the existing route behavior, validation and data integration.

![Desktop page design study, Sea Import](layout_previews/06_sea-import_desktop.png)

![Mobile page design study, Sea Import](layout_previews/06_sea-import_mobile.png)

### 24.8. Air Export (`/services/international-freight-forwarding/air-export`)

**Navigation group:** International Freight. **Page grammar:** airout. **Primary design move:** Outbound checklist as the visual structure.

**Desktop composition:** Dark-mode outbound flight narrative. Cut-off, origin checks and airline handover become the main visual story. Use cut-off and document checklist beside a dark-mode sculpture.

**First visible content:** A true page-specific hero headed "Every departure starts before takeoff.". The first content band is organized around **Cargo acceptance**, **Airline cut-off**, and **Destination handover**. Replace sample prose with verified company-specific detail while keeping the visual structure.

**Mobile direction:** Recompose to one clear primary reading order. Headline must remain legible at 360px/390px, the 3D subject must be visible without horizontal overflow and action controls must remain reachable. Do not merely squeeze the desktop 12-column grid.

**Motion and behavior:** Line wipe follows route geometry on page load. Provide reduced-motion static alternatives. Preserve the existing route behavior, validation and data integration.

![Desktop page design study, Air Export](layout_previews/07_air-export_desktop.png)

![Mobile page design study, Air Export](layout_previews/07_air-export_mobile.png)

### 24.9. Sea Export (`/services/international-freight-forwarding/sea-export`)

**Navigation group:** International Freight. **Page grammar:** seaout. **Primary design move:** Export container stage, not a reused import composition.

**Desktop composition:** Export equipment editorial. Container sculpture and a document sequence, with equipment and gate cut-off as first-class content. Reverse major composition relative to sea import. Add stuffing and gate-in blocks.

**First visible content:** A true page-specific hero headed "Plan the journey before the container moves.". The first content band is organized around **Equipment selection**, **Stuffing and cut-off**, and **Bill of lading**. Replace sample prose with verified company-specific detail while keeping the visual structure.

**Mobile direction:** Recompose to one clear primary reading order. Headline must remain legible at 360px/390px, the 3D subject must be visible without horizontal overflow and action controls must remain reachable. Do not merely squeeze the desktop 12-column grid.

**Motion and behavior:** The container seam light moves subtly on a controlled timed loop. Provide reduced-motion static alternatives. Preserve the existing route behavior, validation and data integration.

![Desktop page design study, Sea Export](layout_previews/08_sea-export_desktop.png)

![Mobile page design study, Sea Export](layout_previews/08_sea-export_mobile.png)

### 24.10. Customs Brokerage (`/services/customs-brokerage`)

**Navigation group:** Services. **Page grammar:** customs. **Primary design move:** Customs Brokerage should have its own first-screen information hierarchy.

**Desktop composition:** Paperwork and trade-compliance layout. Document stack, classification logic and status panel, not cargo hero repetition. Paperwork and trade-compliance layout. Document stack, classification logic and status panel, not cargo hero repetition.

**First visible content:** A true page-specific hero headed "Good clearance begins with sound preparation.". The first content band is organized around **Document readiness**, **Classification and permits**, and **Entry and release**. Replace sample prose with verified company-specific detail while keeping the visual structure.

**Mobile direction:** Recompose to one clear primary reading order. Headline must remain legible at 360px/390px, the 3D subject must be visible without horizontal overflow and action controls must remain reachable. Do not merely squeeze the desktop 12-column grid.

**Motion and behavior:** Use a single deliberate page-entry movement plus direct interaction feedback; no scroll reveal. Provide reduced-motion static alternatives. Preserve the existing route behavior, validation and data integration.

![Desktop page design study, Customs Brokerage](layout_previews/09_customs_desktop.png)

![Mobile page design study, Customs Brokerage](layout_previews/09_customs_mobile.png)

### 24.11. 3PL & Warehousing (`/services/3pl-warehousing`)

**Navigation group:** Services. **Page grammar:** warehouse. **Primary design move:** 3PL & Warehousing should have its own first-screen information hierarchy.

**Desktop composition:** Facility cross-section. Warehouse racks occupy the main visual field; inbound, inventory and outbound are displayed in operational order. Facility cross-section. Warehouse racks occupy the main visual field; inbound, inventory and outbound are displayed in operational order.

**First visible content:** A true page-specific hero headed "Control starts before dispatch.". The first content band is organized around **Inbound accuracy**, **Stock control**, and **Outbound execution**. Replace sample prose with verified company-specific detail while keeping the visual structure.

**Mobile direction:** Recompose to one clear primary reading order. Headline must remain legible at 360px/390px, the 3D subject must be visible without horizontal overflow and action controls must remain reachable. Do not merely squeeze the desktop 12-column grid.

**Motion and behavior:** Use a single deliberate page-entry movement plus direct interaction feedback; no scroll reveal. Provide reduced-motion static alternatives. Preserve the existing route behavior, validation and data integration.

![Desktop page design study, 3PL & Warehousing](layout_previews/10_warehouse_desktop.png)

![Mobile page design study, 3PL & Warehousing](layout_previews/10_warehouse_mobile.png)

### 24.12. Domestic Distribution (`/services/domestic-distribution`)

**Navigation group:** Services. **Page grammar:** distribution. **Primary design move:** Domestic Distribution should have its own first-screen information hierarchy.

**Desktop composition:** Road-control spread. Road transport silhouette and five-mode access rail, with routing and fulfillment decisions as the proof. Road-control spread. Road transport silhouette and five-mode access rail, with routing and fulfillment decisions as the proof.

**First visible content:** A true page-specific hero headed "The right movement for every load.". The first content band is organized around **FTL and LTL**, **FCL and LCL**, and **Domestic air freight**. Replace sample prose with verified company-specific detail while keeping the visual structure.

**Mobile direction:** Recompose to one clear primary reading order. Headline must remain legible at 360px/390px, the 3D subject must be visible without horizontal overflow and action controls must remain reachable. Do not merely squeeze the desktop 12-column grid.

**Motion and behavior:** Use a single deliberate page-entry movement plus direct interaction feedback; no scroll reveal. Provide reduced-motion static alternatives. Preserve the existing route behavior, validation and data integration.

![Desktop page design study, Domestic Distribution](layout_previews/11_domestic_desktop.png)

![Mobile page design study, Domestic Distribution](layout_previews/11_domestic_mobile.png)

### 24.13. FTL / Full Truckload (`/services/domestic-distribution/ftl`)

**Navigation group:** Domestic Distribution. **Page grammar:** ground. **Primary design move:** Vehicle suitability as the first hierarchy.

**Desktop composition:** Dedicated road-load format. Strong vehicle geometry, dispatch timeline and document handover panel. Use a wide freight unit with specifications aligned at the bottom edge.

**First visible content:** A true page-specific hero headed "One truck. One planned movement.". The first content band is organized around **Vehicle suitability**, **Pickup and dispatch**, and **Proof of delivery**. Replace sample prose with verified company-specific detail while keeping the visual structure.

**Mobile direction:** Recompose to one clear primary reading order. Headline must remain legible at 360px/390px, the 3D subject must be visible without horizontal overflow and action controls must remain reachable. Do not merely squeeze the desktop 12-column grid.

**Motion and behavior:** Vehicle passes only a very short distance in load-state, then stops. Provide reduced-motion static alternatives. Preserve the existing route behavior, validation and data integration.

![Desktop page design study, FTL / Full Truckload](layout_previews/12_ftl_desktop.png)

![Mobile page design study, FTL / Full Truckload](layout_previews/12_ftl_mobile.png)

### 24.14. LTL / Less Than Truckload (`/services/domestic-distribution/ltl`)

**Navigation group:** Domestic Distribution. **Page grammar:** consolidation. **Primary design move:** Consolidation pattern, not a full-truck hero.

**Desktop composition:** Shared-capacity format. Freight units and consolidation rule diagram take priority over generic vehicle imagery. Make routing, consolidation, shared handling and volumetric assessment visually legible.

**First visible content:** A true page-specific hero headed "Shared capacity. Precise coordination.". The first content band is organized around **Consolidation**, **Hub handling**, and **Delivery sequence**. Replace sample prose with verified company-specific detail while keeping the visual structure.

**Mobile direction:** Recompose to one clear primary reading order. Headline must remain legible at 360px/390px, the 3D subject must be visible without horizontal overflow and action controls must remain reachable. Do not merely squeeze the desktop 12-column grid.

**Motion and behavior:** Cargo units settle in sequence with no input blocking. Provide reduced-motion static alternatives. Preserve the existing route behavior, validation and data integration.

![Desktop page design study, LTL / Less Than Truckload](layout_previews/13_ltl_desktop.png)

![Mobile page design study, LTL / Less Than Truckload](layout_previews/13_ltl_mobile.png)

### 24.15. FCL / Full Container Load (`/services/domestic-distribution/fcl`)

**Navigation group:** Domestic Distribution. **Page grammar:** container. **Primary design move:** Container equipment as principal object.

**Desktop composition:** Equipment and inland terminal format. Container stack, numbered movement stages and slot / release notes. Place equipment chart and port coordination in tight editorial columns.

**First visible content:** A true page-specific hero headed "Container moves, without fragmented planning.". The first content band is organized around **Container planning**, **Terminal handover**, and **Final delivery**. Replace sample prose with verified company-specific detail while keeping the visual structure.

**Mobile direction:** Recompose to one clear primary reading order. Headline must remain legible at 360px/390px, the 3D subject must be visible without horizontal overflow and action controls must remain reachable. Do not merely squeeze the desktop 12-column grid.

**Motion and behavior:** A single stack module moves into alignment once. Provide reduced-motion static alternatives. Preserve the existing route behavior, validation and data integration.

![Desktop page design study, FCL / Full Container Load](layout_previews/14_fcl_desktop.png)

![Mobile page design study, FCL / Full Container Load](layout_previews/14_fcl_mobile.png)

### 24.16. LCL / Less Than Container Load (`/services/domestic-distribution/lcl`)

**Navigation group:** Domestic Distribution. **Page grammar:** manifest. **Primary design move:** Manifest and cargo-unit structure.

**Desktop composition:** Consolidated sea-cargo format. Multiple cargo units and documentary handovers create a denser visual rhythm. Build an item grouping graphic and handover records, not a recycled FCL stage.

**First visible content:** A true page-specific hero headed "The small details move the shipment.". The first content band is organized around **Consolidation**, **Documentation**, and **Release control**. Replace sample prose with verified company-specific detail while keeping the visual structure.

**Mobile direction:** Recompose to one clear primary reading order. Headline must remain legible at 360px/390px, the 3D subject must be visible without horizontal overflow and action controls must remain reachable. Do not merely squeeze the desktop 12-column grid.

**Motion and behavior:** Row-specific line draw on initial load only. Provide reduced-motion static alternatives. Preserve the existing route behavior, validation and data integration.

![Desktop page design study, LCL / Less Than Container Load](layout_previews/15_lcl_desktop.png)

![Mobile page design study, LCL / Less Than Container Load](layout_previews/15_lcl_mobile.png)

### 24.17. Domestic Air Freight (`/services/domestic-distribution/air-freight`)

**Navigation group:** Domestic Distribution. **Page grammar:** airlane. **Primary design move:** Domestic lane and dispatch timing.

**Desktop composition:** Domestic air-handover format. Air craft relief, origin-to-destination stages and last-mile coordination. Make airports, handling and last-mile dependencies easy to scan.

**First visible content:** A true page-specific hero headed "Reach the next destination with clarity.". The first content band is organized around **Airport handover**, **Flight milestones**, and **Last-mile arrangement**. Replace sample prose with verified company-specific detail while keeping the visual structure.

**Mobile direction:** Recompose to one clear primary reading order. Headline must remain legible at 360px/390px, the 3D subject must be visible without horizontal overflow and action controls must remain reachable. Do not merely squeeze the desktop 12-column grid.

**Motion and behavior:** One route-line travel through the air object; non-looping. Provide reduced-motion static alternatives. Preserve the existing route behavior, validation and data integration.

![Desktop page design study, Domestic Air Freight](layout_previews/16_domestic-air_desktop.png)

![Mobile page design study, Domestic Air Freight](layout_previews/16_domestic-air_mobile.png)

### 24.18. Project Cargo (`/services/project-cargo`)

**Navigation group:** Services. **Page grammar:** project. **Primary design move:** Load geometry is the evidence.

**Desktop composition:** Engineered dark-mode case composition. Large heavy-lift scene and technical parameters as a precise horizontal specification. Specify dimensions, gross mass, lifting points, escorts and operational constraints when verified.

**First visible content:** A true page-specific hero headed "Move the unusual.". The first content band is organized around **Cargo dimensions**, **Handling and routing**, and **Execution readiness**. Replace sample prose with verified company-specific detail while keeping the visual structure.

**Mobile direction:** Recompose to one clear primary reading order. Headline must remain legible at 360px/390px, the 3D subject must be visible without horizontal overflow and action controls must remain reachable. Do not merely squeeze the desktop 12-column grid.

**Motion and behavior:** Engineered path/rigging animation on page load, then static. Provide reduced-motion static alternatives. Preserve the existing route behavior, validation and data integration.

![Desktop page design study, Project Cargo](layout_previews/17_project_desktop.png)

![Mobile page design study, Project Cargo](layout_previews/17_project_mobile.png)

### 24.19. Solutions (`/solutions`)

**Navigation group:** Core. **Page grammar:** industry. **Primary design move:** Solutions are keyed to buyer problems.

**Desktop composition:** Industry-led editorial sequence. Distinct operating needs appear as separated horizontal bands, rather than a standard service grid. Industry-specific page sections show cargo profile, coordination needs and suitable service mix.

**First visible content:** A true page-specific hero headed "Not every supply chain asks the same question.". The first content band is organized around **Trading and commerce**, **Industrial operations**, and **Project-led requirements**. Replace sample prose with verified company-specific detail while keeping the visual structure.

**Mobile direction:** Recompose to one clear primary reading order. Headline must remain legible at 360px/390px, the 3D subject must be visible without horizontal overflow and action controls must remain reachable. Do not merely squeeze the desktop 12-column grid.

**Motion and behavior:** Each industry band uses a different timed motif, not identical rise-in. Provide reduced-motion static alternatives. Preserve the existing route behavior, validation and data integration.

![Desktop page design study, Solutions](layout_previews/18_solutions_desktop.png)

![Mobile page design study, Solutions](layout_previews/18_solutions_mobile.png)

### 24.20. Network (`/network`)

**Navigation group:** Core. **Page grammar:** network. **Primary design move:** Coverage is an evidence-based interface.

**Desktop composition:** Abstract corridor-control graphic. Show operating handovers without implying verified offices, partner footprints or country coverage. No implied worldwide offices. Use a filterable corridor status only for vetted lanes.

**First visible content:** A true page-specific hero headed "A route is only as strong as its handovers.". The first content band is organized around **Coverage methodology**, **Origin to destination**, and **Handover checkpoints**. Replace sample prose with verified company-specific detail while keeping the visual structure.

**Mobile direction:** Recompose to one clear primary reading order. Headline must remain legible at 360px/390px, the 3D subject must be visible without horizontal overflow and action controls must remain reachable. Do not merely squeeze the desktop 12-column grid.

**Motion and behavior:** Draw verified handover path with gentle timed movement. Provide reduced-motion static alternatives. Preserve the existing route behavior, validation and data integration.

![Desktop page design study, Network](layout_previews/19_network_desktop.png)

![Mobile page design study, Network](layout_previews/19_network_mobile.png)

### 24.21. Insights (`/insights`)

**Navigation group:** Core. **Page grammar:** journal. **Primary design move:** Native editorial direction.

**Desktop composition:** Magazine landing page. Oversized masthead, one featured article and a varied editorial index with honest publish status. No fabricated archive history or unverified publication dates; article cards use real CMS data.

**First visible content:** A true page-specific hero headed "Ideas for freight decisions that matter.". The first content band is organized around **In-depth analysis**, **Practical explainers**, and **Industry observations**. Replace sample prose with verified company-specific detail while keeping the visual structure.

**Mobile direction:** Recompose to one clear primary reading order. Headline must remain legible at 360px/390px, the 3D subject must be visible without horizontal overflow and action controls must remain reachable. Do not merely squeeze the desktop 12-column grid.

**Motion and behavior:** Magazine-style cover settles on load and stays still. Provide reduced-motion static alternatives. Preserve the existing route behavior, validation and data integration.

![Desktop page design study, Insights](layout_previews/20_insights_desktop.png)

![Mobile page design study, Insights](layout_previews/20_insights_mobile.png)

### 24.22. FAQ (`/faq`)

**Navigation group:** Core. **Page grammar:** questions. **Primary design move:** Answers must be findable.

**Desktop composition:** Question-first content. Large category navigation, readable accordion rows and links to deeper service specifications. Questions grouped by topic, visible headings, proper details/summary semantics.

**First visible content:** A true page-specific hero headed "The questions that shape a shipment.". The first content band is organized around **Quotations**, **Shipping documents**, and **Cargo handling**. Replace sample prose with verified company-specific detail while keeping the visual structure.

**Mobile direction:** Recompose to one clear primary reading order. Headline must remain legible at 360px/390px, the 3D subject must be visible without horizontal overflow and action controls must remain reachable. Do not merely squeeze the desktop 12-column grid.

**Motion and behavior:** Accordions respond to user interaction, not ambient animation. Provide reduced-motion static alternatives. Preserve the existing route behavior, validation and data integration.

![Desktop page design study, FAQ](layout_previews/21_faq_desktop.png)

![Mobile page design study, FAQ](layout_previews/21_faq_mobile.png)

### 24.23. Contact (`/contact`)

**Navigation group:** Core. **Page grammar:** contact. **Primary design move:** Contact details remain approved.

**Desktop composition:** Direct enquiry page. Clear business details, address and accessible contact form, with no public phone or WhatsApp number. Email and approved Jakarta address visible; do not render any phone or WhatsApp contact.

**First visible content:** A true page-specific hero headed "A real conversation starts with the right details.". The first content band is organized around **General enquiries**, **Business contact**, and **Office location**. Replace sample prose with verified company-specific detail while keeping the visual structure.

**Mobile direction:** Recompose to one clear primary reading order. Headline must remain legible at 360px/390px, the 3D subject must be visible without horizontal overflow and action controls must remain reachable. Do not merely squeeze the desktop 12-column grid.

**Motion and behavior:** Immediate field feedback and accessible success/error states. Provide reduced-motion static alternatives. Preserve the existing route behavior, validation and data integration.

![Desktop page design study, Contact](layout_previews/22_contact_desktop.png)

![Mobile page design study, Contact](layout_previews/22_contact_mobile.png)

### 24.24. Request a Quote (`/request-quote`)

**Navigation group:** Action. **Page grammar:** rfq. **Primary design move:** Commercial data capture is the function.

**Desktop composition:** Conversion-focused structured form. Operational inputs grouped by route, cargo, schedule and customer information; never hide mandatory fields. Clearly label all required inputs and send an accurate submission acknowledgement.

**First visible content:** A true page-specific hero headed "Tell us what needs to move.". The first content band is organized around **Shipment details**, **Cargo specifications**, and **Contact and submission**. Replace sample prose with verified company-specific detail while keeping the visual structure.

**Mobile direction:** Recompose to one clear primary reading order. Headline must remain legible at 360px/390px, the 3D subject must be visible without horizontal overflow and action controls must remain reachable. Do not merely squeeze the desktop 12-column grid.

**Motion and behavior:** Step state advances only on successful validation and direct user action. Provide reduced-motion static alternatives. Preserve the existing route behavior, validation and data integration.

![Desktop page design study, Request a Quote](layout_previews/23_rfq_desktop.png)

![Mobile page design study, Request a Quote](layout_previews/23_rfq_mobile.png)

### 24.25. Admin Portal (supplementary) (`/admin`)

**Navigation group:** Supplement. **Page grammar:** admin. **Primary design move:** Admin Portal (supplementary) should have its own first-screen information hierarchy.

**Desktop composition:** Separate productive workspace. Persistent navigation, status KPIs and action queues, with compact tables and fewer decorative surfaces. Separate productive workspace. Persistent navigation, status KPIs and action queues, with compact tables and fewer decorative surfaces.

**First visible content:** A true page-specific hero headed "Clear next actions. Dense information.". The first content band is organized around **Commercial workflow**, **Finance workflow**, and **Website controls**. Replace sample prose with verified company-specific detail while keeping the visual structure.

**Mobile direction:** Recompose to one clear primary reading order. Headline must remain legible at 360px/390px, the 3D subject must be visible without horizontal overflow and action controls must remain reachable. Do not merely squeeze the desktop 12-column grid.

**Motion and behavior:** Use a single deliberate page-entry movement plus direct interaction feedback; no scroll reveal. Provide reduced-motion static alternatives. Preserve the existing route behavior, validation and data integration.

![Desktop page design study, Admin Portal (supplementary)](layout_previews/24_admin_desktop.png)

![Mobile page design study, Admin Portal (supplementary)](layout_previews/24_admin_mobile.png)

### 24.26. Privacy (footer) (`/privacy`)

**Navigation group:** Supplement. **Page grammar:** policy. **Primary design move:** Privacy (footer) should have its own first-screen information hierarchy.

**Desktop composition:** Plain legal document composition. Simple contents rail, readable type, effective-date metadata and no decorative fake seals. Plain legal document composition. Simple contents rail, readable type, effective-date metadata and no decorative fake seals.

**First visible content:** A true page-specific hero headed "Clear handling of personal information.". The first content band is organized around **Collection**, **Use and storage**, and **Rights and contact**. Replace sample prose with verified company-specific detail while keeping the visual structure.

**Mobile direction:** Recompose to one clear primary reading order. Headline must remain legible at 360px/390px, the 3D subject must be visible without horizontal overflow and action controls must remain reachable. Do not merely squeeze the desktop 12-column grid.

**Motion and behavior:** Use a single deliberate page-entry movement plus direct interaction feedback; no scroll reveal. Provide reduced-motion static alternatives. Preserve the existing route behavior, validation and data integration.

![Desktop page design study, Privacy (footer)](layout_previews/25_privacy_desktop.png)

![Mobile page design study, Privacy (footer)](layout_previews/25_privacy_mobile.png)

### 24.27. Terms (footer) (`/terms`)

**Navigation group:** Supplement. **Page grammar:** policy. **Primary design move:** Terms (footer) should have its own first-screen information hierarchy.

**Desktop composition:** Plain legal document composition. Simple contents rail, readable type, effective-date metadata and no decorative fake seals. Plain legal document composition. Simple contents rail, readable type, effective-date metadata and no decorative fake seals.

**First visible content:** A true page-specific hero headed "Terms that can actually be read.". The first content band is organized around **Scope and definitions**, **Terms of use**, and **Questions and changes**. Replace sample prose with verified company-specific detail while keeping the visual structure.

**Mobile direction:** Recompose to one clear primary reading order. Headline must remain legible at 360px/390px, the 3D subject must be visible without horizontal overflow and action controls must remain reachable. Do not merely squeeze the desktop 12-column grid.

**Motion and behavior:** Use a single deliberate page-entry movement plus direct interaction feedback; no scroll reveal. Provide reduced-motion static alternatives. Preserve the existing route behavior, validation and data integration.

![Desktop page design study, Terms (footer)](layout_previews/26_terms_desktop.png)

![Mobile page design study, Terms (footer)](layout_previews/26_terms_mobile.png)


## 25. Atlas implementation contract

The 26 visual studies are direction-setting **page compositions**, not one React template with string replacements. During production, each route must be given a named page design strategy, a distinct upper-fold layout, distinct visual subject or editorial structure, a clearly differentiated second section, and a specific motion signature. Shared global brand tokens, header, typography, footer and input rules remain consistent.

**Menu coverage is evaluated against the live CMS navigation and the repository fallback**, not just screenshots in this document. On each breakpoint (360, 390, 768, 1024, 1440 and 1920 pixels), review the entire page to ensure no overflow, clipping, unintentional duplicated illustrations, fake claims, overlong headlines, empty galleries or dead interactions. A desktop screenshot alone is insufficient. Validate keyboard navigation, menu closing behavior, active-link indicators and reduced motion on every route.

**Asset production:** Do not turn the schematic diagrams in these previews into VORA's final 3D library. Create and review realistic, architectural logistics subjects with controlled material variation, contact shadows, believable scale, correct equipment silhouettes and the approved palette. Each service mode needs a different composition or subject treatment. Avoid generic plane/container/box illustrations without service-specific context.

**Client content warning:** All example headings, units, document labels and interface counts are visual content placeholders. They are not evidence of past jobs, service availability, transit-time commitments, certifications, customer contracts, legal compliance or live operational data.

## 26. Delivery manifest

- `design.md`: canonical written system, including page specs and embedded relative PNG previews.
- `VORA_Design_System.pdf`: printable system plus 26 page plates for desktop and mobile.
- `VORA_All_Pages_Preview.html`: standalone responsive concept browser with every page accessible via the top selector.
- `layout_previews/`: browser-rendered images and atlas plates.
- `VORA_Design_System_Complete.zip`: portable bundle preserving the relative paths used by Markdown.

**Final creative checkpoint:** The website must feel composed, architectural and operationally credible. Each navigation destination should be recognizable from its own composition even when its copy is removed. That is the difference between a design system and 26 reskinned landing pages.


## 27. Owner-approved visual atlas and final art direction

These five images are the approved visual target for VORA. They take precedence over older schematic concept screenshots when judging depth, material treatment and page-to-page differentiation. They are reference compositions, not finished webpages or a license to publish fabricated metrics.

### 27.1 Brand system and complete site overview

Global brand application, multi-page rhythm, tactile UI elements.

![Approved VORA visual reference 01: Brand system and complete site overview](visual_references/VORA_Approved_Reference_01.png)

### 27.2 FTL, LTL, FCL, LCL and domestic air freight

Distinct service-level compositions and meaningful logistics objects.

![Approved VORA visual reference 02: FTL, LTL, FCL, LCL and domestic air freight](visual_references/VORA_Approved_Reference_02.png)

### 27.3 Air import, sea import, air export and sea export

Directional shipment workflows, routes, milestones and operational context.

![Approved VORA visual reference 03: Air import, sea import, air export and sea export](visual_references/VORA_Approved_Reference_03.png)

### 27.4 International freight, customs, warehousing, domestic and project cargo

Distinct hero arrangements and varied content structures.

![Approved VORA visual reference 04: International freight, customs, warehousing, domestic and project cargo](visual_references/VORA_Approved_Reference_04.png)

### 27.5 Home, About, Services, Solutions, Network, Insights, FAQ and Contact

Primary navigation pages and corporate information layouts.

![Approved VORA visual reference 05: Home, About, Services, Solutions, Network, Insights, FAQ and Contact](visual_references/VORA_Approved_Reference_05.png)

### 27.6 Application rules for Claude Code

- Preserve the official VORA identity and approved navy `#101720` and red `#B43E31`. The owner-supplied boards are visual concepts and may contain approximate logo forms, unsupported statements and invented figures. Never copy those as factual site content.
- Use the original individual 3D object library from `ASET_WEB_VORA_1.zip` and `ASET_WEB_VORA_2.zip` or the already prepared VORA visual kit. Keep assets as independent layers with transparent backgrounds where applicable.
- Produce the tactile feel with real HTML/CSS components: sculpted button bevels, inset panels, directional ambient illumination, realistic contact shadows, restrained gloss, plinth surfaces and layered architectural geometry.
- Differentiate the first viewport and the second major section on each route. Air Import must not share Sea Import's hero structure; FTL must not repeat LTL's composition with merely a changed vehicle.
- Treat tracking widgets, dates, delivery estimates, operational statistics, customer counts and certifications shown in references as nonfactual placeholders. Functional UI must be connected to real data or clearly labeled as an illustrative concept.
- Maintain contrast, focus-visible states, standard cursors, readable typography, responsive 360px and 390px layouts, and reduced-motion fallbacks.

**PDF note:** The five owner-approved full-size boards are embedded as a landscape appendix after the original written design system and 26 route studies. The earlier studies are structure reference only when visual art direction differs.
