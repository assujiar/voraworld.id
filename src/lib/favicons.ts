import type { Icons } from 'next/dist/lib/metadata/types/metadata-types'

/**
 * The site's icons, the same for the public site, the portal and the document pages (made by `npm run build:favicons` from the approved reverse A icon).
 * Order matters: /favicon.ico serves every browser that asks for it (Safari and older ones), the SVG is taken by the browsers that prefer a vector (Chrome, Edge, Firefox),
 * and the 180 px square is what iOS puts on a home screen.
 */
export const ICONS = {
  icon: [
    { url: '/favicon.ico', sizes: '32x32' },
    { url: '/favicon.svg', type: 'image/svg+xml' },
    { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
  ],
  apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
} satisfies Icons
export const MANIFEST = '/site.webmanifest'
