# VORA Production Visual Kit | v1.0

Date: 2 November 2026

A production-oriented library of individual, transparent objects and page-specific composited art, plus scalable, separable SVG foreground elements and section backgrounds.

The 43 ORIGINAL OBJECT images are kept intact from the two VORA source ZIPs. The 26 COMPOSED HERO SCENES are assembled independently from those specific original source objects with atmospheric grounding, stage relief and red/navy visual rails. No page-atlas screenshots have been cut up and passed off as objects.

## Folder structure

- `public/vora-visual/objects/`: original individual cutouts and their web-optimized WebP copies.
- `public/vora-visual/scenes/`: 26 individual RGBA PNG masters and 26 WebP website derivatives. Each has transparent negative space, no text, no buttons, and no fake brand mark.
- `public/vora-visual/graphics/`: 16 reusable, standalone SVG sculptural plinths, orbits, ribbons, rails, tactile plates and reliefs.
- `public/vora-visual/backgrounds/`: 8 separate page/section backdrops in SVG.
- `public/vora-visual/ui/`: 5 scalable SVG UI texture/surface assets, NOT interactive controls.
- `ASSET_MANIFEST.json`: machine-readable mapping, route associations and provenance.
- `ASSET_MANIFEST.csv`: one-row-per-asset references.
- `preview/`: interactive browser preview and preview contact sheets (reference-only, not production image assets).
- `docs/`: Claude implementation prompt, usage notes and a Next.js/React/CSS example.

## Immediate usage in the existing Next.js repository

Copy the entire contents of this kit's `public/vora-visual/` into your repository's `public/vora-visual/`. Preserve everything else in the repository. Paths are then usable as `/vora-visual/...` with `next/image` or regular image tags as appropriate.

**Use WebP scenes and objects on the site.** Keep full PNG originals out of the deployment if shipping size matters; the web-optimized ZIP contains only assets needed by the app. PNG masters remain in the complete archive.

Example:

```tsx
import Image from 'next/image';

export function ProjectCargoArtwork() {
  return (
    <div className="vora-art-stage vora-art-stage--heavy" aria-hidden="true">
      <Image
        src="/vora-visual/scenes/vora-scene-project.webp"
        alt=""
        width={1480}
        height={1000}
        priority
        className="vora-art-object"
      />
    </div>
  );
}
```

For more expressive multi-layer art, render the original cutout as an independent `Image` above a CSS plinth and SVG graphic. See `docs/VORA_ART_COMPONENT.tsx` and `docs/vora-art.css`.

## Key creative constraints

1. Colors are locked to midnight navy `#101720`, official red `#B43E31`, and paper `#F7F7F4`, with white and engineered neutral surfaces. Use color gradients only to indicate relief and materials.
2. **Preserve the official logo** as it already exists at `/static/assets/vora-primary.svg` in the VORA repository. Do not use logo drawings from generated design posters. The A-shaped logo icon must remain the approved original. Do not redraw it from visual memory.
3. 3D sculpture must remain realistic, industrial, physically plausible and adult, not cartoon or toy-like. Show natural contact shadows, highlights, matte ceramic and satin metallic finishes.
4. Neumorphism is a surface treatment: recessed fields, raised buttons, clear elevation levels and actual affordances, NOT identical floating cards across every section.
5. Every page has distinct composition, content hierarchy, art staging and motion, not one repeated hero template with a different object. The `preview/index.html` file shows the differentiated page compositions.
6. The hero scene is not the entire design. Compose text, controls, grids, infographics and service modules as actual HTML/React so everything is accessible, responsive and editable.
7. Never turn the previews into single flattened page images. Do not crop any preview collage for a hero or service tile.
8. Keep site cursor native, obey reduced motion and avoid scroll-triggered animation for the primary reveals.
9. Avoid fictional operational metrics, awards, certificates, customer logos, ships branded VORA, customer proof or fabricated case studies.
10. The public website never exposes a telephone or WhatsApp number and never links to the admin route.

## Role of scene files and graphic files

The composited hero scene is a zero-text visual shortcut for a well-defined page. The object cutouts and SVG graphics should be used to vary subsequent sections: sometimes full-bleed horizontal, sometimes split editorial, sometimes an oversized monolith, sometimes a technical diagram and sometimes a recessed physical tray. Do not show another floating plinth in every section.

## Source and limits

- Original input: `ASET_WEB_VORA_1.zip` and `ASET_WEB_VORA_2.zip` supplied by the owner.
- The original PNG/WebP objects were not generated afresh and are not assembled from a contact sheet.
- The composited scenes and SVG reliefs are locally created from those originals, **not** new photorealistic renders of industrial equipment.
- Current brand logo SVG is not bundled here; load it from the current repository as indicated above.
- Layout previews are art-direction studies and cannot be treated as evidence of real customer jobs, rates, services or performance.
- The preview gallery is static standalone HTML; it does not change the repository or the public website.
