'use client'
import { useEffect, useState } from 'react'
import { makeT, type Locale } from '@/content'
export function SectionNav({locale}:{locale:Locale}) {
  const t=makeT(locale),[active,setActive]=useState('overview')
  const items=[['overview',t('Overview','Ringkasan')],['process',t('Process','Proses')],['preparation',t('Preparation','Persiapan')],['service-faq', 'FAQ']]
  useEffect(()=>{
    if(!('IntersectionObserver' in window))return
    const visible=new Set<string>()
    const observer=new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting)visible.add(e.target.id);else visible.delete(e.target.id)});const current=items.find(([id])=>visible.has(id));if(current)setActive(current[0])},{rootMargin:'-120px 0px -35% 0px',threshold:0})
    items.forEach(([id])=>{const el=document.getElementById(id);if(el)observer.observe(el)})
    return ()=>observer.disconnect()
  // Section IDs stay the same across locales.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[])
  return <nav className="ux-section-nav" aria-label={t('On this page','Di halaman ini')}><div className="v-wrap"><span>{t('On this page','Di halaman ini')}</span>{items.map(([id,label])=><a key={id} href={`#${id}`} onClick={()=>setActive(id)} aria-current={active===id?'location':undefined}>{label}</a>)}</div></nav>
}
