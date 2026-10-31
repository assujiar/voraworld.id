import type { Metadata, Viewport } from 'next'

export const dynamic = 'force-dynamic'
/** PDF rendering, uploads and sending email run inside these routes: allow more than the platform default. */
export const maxDuration = 30
export const metadata: Metadata = { title: { absolute: 'VORA Document Verification' }, robots: { index: false, follow: false }, referrer: 'no-referrer', icons: { icon: [{ url: '/static/assets/vora-a-icon-primary.svg', type: 'image/svg+xml' }] } }
export const viewport: Viewport = { themeColor: '#101720', width: 'device-width', initialScale: 1 }

/** Private document pages reached from a QR code or an emailed link: standalone, never indexed, never cached. */
export default function DocsRoot({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head><link rel="stylesheet" href="/static/css/site.css" /><link rel="stylesheet" href="/static/css/feedback.css?v=6" /><link rel="stylesheet" href="/static/css/verify.css?v=4" /></head>
      <body>{children}</body>
    </html>
  )
}
