# Implementation brief for Claude Code

Target repository: `assujiar/voraworld.id`, current `main` branch, existing Next.js 15, React 19, TypeScript, Supabase and Remotion.

Use `ASSET_MANIFEST.json` as an authoritative image mapping. The kit is purely visual and does not authorize backend changes.

## Rules of engagement

- Inspect the current repository before editing. Create a branch and avoid unrelated refactors.
- Preserve the original VORA logo assets, authorization, documents, data, SEO and admin application behavior.
- Use the supplied object assets and scene art rather than generated mockup screenshots.
- Never flatten text or input fields into an image. Build actual semantic HTML, forms and buttons.
- Strengthen claymorphism using tactile scalloped plinths, layer separation, controlled gloss, practical shadows, inset panels and material-aware elevation.
- Stronger neumorphism must improve affordance clarity, not lower contrast or usability.
- Use one of the distinct art composition families per route. Each route has specific art and module hierarchy.
- Implement CSS variables centrally; avoid another large patch of duplicated global rules.
- Motion can be Remotion or CSS and should arrive without scroll-trigger dependency; respect reduced motion, retain native cursor.
- Optimize WebP in production and preload only the LCP hero for the current page; lazy load below-fold art.
- Confirm desktop at 1440 and 1920 px, mobile at 390 and 360 px, mid-size 768 and 1024 px, keyboard and reduced-motion mode.

## Route-to-scene mapping

| Route | Composition focus | Hero WebP |
| --- | --- | --- |
| `/` | Flagship horizontal cinematic multi-modal story and service ramp | `/vora-visual/scenes/vora-scene-home.webp` |
| `/about` | Large brand manifesto, typographic opening and orbital monolith | `/vora-visual/scenes/vora-scene-about.webp` |
| `/services` | Editorial five-service directory with broken-grid composition | `/vora-visual/scenes/vora-scene-services.webp` |
| `/services/international-freight-forwarding` | Dark port-inspired stage and international operations sequence | `/vora-visual/scenes/vora-scene-freight.webp` |
| `/services/international-freight-forwarding/air-import` | Diagonal flight arrival composition and cargo handoff rail | `/vora-visual/scenes/vora-scene-air-import.webp` |
| `/services/international-freight-forwarding/sea-import` | Ship arrival / port process with operational progression | `/vora-visual/scenes/vora-scene-sea-import.webp` |
| `/services/international-freight-forwarding/air-export` | Airborne diagonal composition and booking preparation panels | `/vora-visual/scenes/vora-scene-air-export.webp` |
| `/services/international-freight-forwarding/sea-export` | Loading crane composition with document handoff sequence | `/vora-visual/scenes/vora-scene-sea-export.webp` |
| `/services/customs-brokerage` | Recessed document stage, modular clearance checklist | `/vora-visual/scenes/vora-scene-customs.webp` |
| `/services/3pl-warehousing` | Architectural warehouse elevation and receiving flow | `/vora-visual/scenes/vora-scene-warehouse.webp` |
| `/services/domestic-distribution` | Horizontal route panorama and vehicle mode comparison | `/vora-visual/scenes/vora-scene-domestic.webp` |
| `/services/domestic-distribution/ftl` | Oversized single truck with dedicated movement graphic | `/vora-visual/scenes/vora-scene-ftl.webp` |
| `/services/domestic-distribution/ltl` | Consolidation module split with freight aggregation details | `/vora-visual/scenes/vora-scene-ltl.webp` |
| `/services/domestic-distribution/fcl` | Full-height container sculpture and equipment/terminal modules | `/vora-visual/scenes/vora-scene-fcl.webp` |
| `/services/domestic-distribution/lcl` | Shared space / item-level flow using layered load arrangements | `/vora-visual/scenes/vora-scene-lcl.webp` |
| `/services/domestic-distribution/air-freight` | Low-angle jet scene and time-critical routing composition | `/vora-visual/scenes/vora-scene-domestic-air.webp` |
| `/services/project-cargo` | Deep navy engineering stage, oversize cargo and constraints | `/vora-visual/scenes/vora-scene-project.webp` |
| `/solutions` | Industry segment collage with asymmetrical multicolumn blocks | `/vora-visual/scenes/vora-scene-solutions.webp` |
| `/network` | Orbital network centerpiece and coverage explanation | `/vora-visual/scenes/vora-scene-network.webp` |
| `/insights` | Magazine feature hierarchy with editorial article previews | `/vora-visual/scenes/vora-scene-insights.webp` |
| `/faq` | Deeply inset accordion body and smaller symbolic art | `/vora-visual/scenes/vora-scene-faq.webp` |
| `/contact` | Lead form as tactile control plane and contact information | `/vora-visual/scenes/vora-scene-contact.webp` |
| `/request-quote` | Shipment input workflow with validated field steps | `/vora-visual/scenes/vora-scene-rfq.webp` |
| `/admin` | Operational portal control surface with functional data tables | `/vora-visual/scenes/vora-scene-admin.webp` |
| `/privacy` | Document first, understated trust motif and legal copy | `/vora-visual/scenes/vora-scene-privacy.webp` |
| `/terms` | Document first, minimal sculptural graphic and legal structure | `/vora-visual/scenes/vora-scene-terms.webp` |

## Do NOT repeat the same hero structure

For each adjacent route vary at least three of these: visual focal point, composition axis, content order, 3D scene stage, contrast ratio, page surface, editorial grid shape, number of visible modules, primary action placement, support navigation. Do not change facts just to look different.

## Implementation acceptance

- All routes in mapping have a designated hero scene and distinct composition.
- All imagery has `alt` treatment appropriate to decorative/meaningful context.
- Every source object remains accessible under `/vora-visual/objects/`.
- No screenshot of a preview board is used in a shipped page.
- No em dashes in new product copy or design documentation.
- No fabricated certification, customer track record, rate, shipment statistic, or office location.
- Provide a screenshot audit matrix after implementation, including at least homepage, service directory, freight, one air subservice, one ocean subservice, project cargo, contact and admin.
- Return changed files, test results and visual comparison.
