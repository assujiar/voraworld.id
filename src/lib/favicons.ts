import type { Icons } from 'next/dist/lib/metadata/types/metadata-types'

/**
 * The site's icons, the same for the public site, the portal and the document pages (made by `npm run build:favicons` from the approved reverse A icon).
 * Order matters: /favicon.ico serves every browser that asks for it (Safari and older ones), the SVG is taken by the browsers that prefer a vector (Chrome, Edge, Firefox),
 * and the 180 px square is what iOS puts on a home screen.
 */
/** Changes when the icon artwork changes, so that browsers, which keep favicons for a long time, fetch the new files. */
const V = '?v=2'
export const ICONS = {
  icon: [
    { url: '/favicon.ico' + V, sizes: '32x32' },
    { url: '/favicon.svg' + V, type: 'image/svg+xml' },
    { url: '/icon-192.png' + V, sizes: '192x192', type: 'image/png' },
  ],
  apple: [{ url: '/apple-touch-icon.png' + V, sizes: '180x180', type: 'image/png' }],
} satisfies Icons
export const MANIFEST = '/site.webmanifest'
