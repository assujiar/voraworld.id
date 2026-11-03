import type { CSSProperties, ReactNode } from 'react'
/** Compatibility wrapper: all content is visible at SSR and never gated by scrolling. */
export function Reveal({ children, className = '', as: Tag = 'div' }: { children: ReactNode; className?: string; delay?: number; as?: 'div' | 'section' | 'p' | 'ul' }) {
  return <Tag className={className}>{children}</Tag>
}
