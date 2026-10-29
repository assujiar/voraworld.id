import type { NextConfig } from 'next'

const isProd = process.env.NODE_ENV === 'production'

// No third-party origins are used. Supabase Storage hosts the images uploaded in the admin.
// Next.js itself needs inline bootstrap scripts, and the dev server needs eval + websockets.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? '' : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://*.supabase.co",
  "font-src 'self' data:",
  `connect-src 'self'${isProd ? '' : ' ws: wss:'}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

const security = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Content-Security-Policy', value: csp },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  ...(isProd ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }] : []),
]

const config: NextConfig = {
  poweredByHeader: false,
  // unpdf ships its own PDF.js build and uses import.meta: it must be loaded from node_modules, not bundled.
  serverExternalPackages: ['unpdf'],
  reactStrictMode: true,
  // Uploads are capped by MAX_UPLOAD_BYTES in the app (and by Vercel's 4.5 MB request limit).
  experimental: { serverActions: { bodySizeLimit: '10mb' } },
  async redirects() {
    return [{ source: '/', destination: '/en', permanent: false }]
  },
  async headers() {
    return [
      { source: '/:path*', headers: security },
      { source: '/verify/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }, { key: 'Cache-Control', value: 'no-store' }, { key: 'Referrer-Policy', value: 'no-referrer' }] },
      { source: '/quotation-approval/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }, { key: 'Cache-Control', value: 'no-store' }, { key: 'Referrer-Policy', value: 'no-referrer' }] },
      { source: '/:locale(en|id)/preview/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }, { key: 'Cache-Control', value: 'no-store' }] },
      { source: '/static/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }] },
    ]
  },
}

export default config
