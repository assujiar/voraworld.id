import type { CSSProperties } from 'react'
export type AtlasIconName = 'air' | 'sea' | 'truck' | 'box' | 'document' | 'route' | 'check' | 'clock' | 'weight' | 'arrow' | 'mail' | 'pin'
const paths: Record<AtlasIconName, React.ReactNode> = {
 air: <><path d="m3 10 7 2 8-8 2 2-7 8 2 7-2 1-4-6-6-4Z"/><path d="m13 8 4 1M8 13l1 4"/></>,
 sea: <><path d="M3 14h18l-3 5H6l-3-5ZM6 14V8h5v6m0-4h7v4M8 8V5h4v5M2 22q3-3 5 0 3-3 5 0 3-3 5 0 3-3 5 0"/></>,
 truck: <><path d="M2 5h12v12H2zM14 9h4l4 5v3h-8M16 10v4h5"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></>,
 box:<><path d="m3 7 9-5 9 5v11l-9 5-9-5V7Zm0 0 9 5 9-5m-9 5v11M7 5l9 5"/></>,
 document:<><path d="M5 2h10l5 5v15H5zM15 2v6h5M8 12h9m-9 4h9m-9 3h5"/></>,
 route:<><circle cx="5" cy="5" r="3"/><circle cx="19" cy="19" r="3"/><path d="M8 5h8a4 4 0 0 1 0 8H8a4 4 0 0 0 0 8h8"/></>,
 check:<><path d="m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6l9-4Z"/><path d="m7 12 3 3 7-7"/></>,
 clock:<><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></>,
 weight:<><path d="M5 8h14l3 14H2L5 8Z"/><circle cx="12" cy="5" r="3"/></>,
 arrow:<path d="M4 12h16m-6-6 6 6-6 6"/>,
 mail:<><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m3 6 9 7 9-7"/></>,
 pin:<><path d="M20 9c0 6-8 13-8 13S4 15 4 9a8 8 0 1 1 16 0Z"/><circle cx="12" cy="9" r="3"/></>,
}
export function AtlasIcon({ name, className = '', style }: { name: AtlasIconName; className?: string; style?: CSSProperties }) {
 return <svg className={`x-icon ${className}`} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}
