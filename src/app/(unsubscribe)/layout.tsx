import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Email preferences | VORA', robots: { index: false, follow: false } }

export default function UnsubscribeRoot({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body style={{ background: '#f5f7f8', color: '#172532', margin: 0 }}>{children}</body></html>
}
