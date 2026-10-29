'use client'
import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { ADMIN_MENU } from '@/content/admin-menu'

const isActive = (path: string, href: string) => path === href || path.startsWith(href + '/')

/** Grouped, collapsible menu. The category holding the current page is open; on phones the whole menu is behind "Menu". */
export function AdminSidebar({ children }: { children: React.ReactNode }) {
  const path = usePathname() || '/admin'
  const outer = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    if (window.matchMedia('(max-width:780px)').matches) outer.current?.removeAttribute('open')
  }, [])
  return (
    <aside className="admin-sidebar">
      <a className="brand" href="/admin"><img src="/static/assets/vora-reverse.svg" alt="VORA admin" /></a>
      <details open ref={outer}>
        <summary className="sidebar-toggle">Menu</summary>
        <nav>
          <a className={path === '/admin' ? 'active' : ''} href="/admin">Overview</a>
          {ADMIN_MENU.map((group) => (
            <details className="menu-group" key={group.title} open={group.links.some((l) => isActive(path, l.href))}>
              <summary>{group.title}</summary>
              {group.links.map((l) => <a key={l.href} className={isActive(path, l.href) ? 'active' : ''} href={l.href}>{l.label}</a>)}
            </details>
          ))}
          {children}
        </nav>
      </details>
    </aside>
  )
}
