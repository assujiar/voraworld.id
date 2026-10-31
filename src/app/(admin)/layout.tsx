import type { Metadata, Viewport } from 'next'

export const dynamic = 'force-dynamic'
/** PDF rendering, uploads and sending email run inside these routes: allow more than the platform default. */
export const maxDuration = 30
export const metadata: Metadata = { title: { absolute: 'VORA Admin' }, robots: { index: false, follow: false }, icons: { icon: [{ url: '/static/assets/vora-a-icon-primary.svg', type: 'image/svg+xml' }] } }
export const viewport: Viewport = { themeColor: '#101720', width: 'device-width', initialScale: 1 }

export default function AdminRoot({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="/static/css/site.css" />
        <link rel="stylesheet" href="/static/css/motion.css?v=2" />
        <link rel="stylesheet" href="/static/css/admin.css?v=1" />
        <link rel="stylesheet" href="/static/css/feedback.css?v=6" />
      </head>
      <body className="admin-body">{children}</body>
    </html>
  )
}
