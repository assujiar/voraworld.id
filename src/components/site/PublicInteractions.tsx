'use client'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

/** Functional disclosure feedback. Existing loaders and automatic artwork motion stay independent. */
export function PublicInteractions() {
  const path=usePathname()
  useEffect(()=>{
    const root=document.getElementById('main')
    if(!root)return
    const revealHash=()=>{
      let target:Element|null=null
      try{target=document.getElementById(decodeURIComponent(location.hash.slice(1)))}catch{return}
      if(target instanceof HTMLDetailsElement && root.contains(target)){target.open=true;target.scrollIntoView({block:'start'})}
    }
    revealHash();window.addEventListener('hashchange',revealHash)
    const animations=new Map<HTMLDetailsElement,Animation>()
    const click=(event:MouseEvent)=>{
      const summary=(event.target as Element).closest('summary')
      const details=summary?.parentElement as HTMLDetailsElement|undefined
      if(!summary||!details||details.tagName!=='DETAILS'||!root.contains(details)||event.target instanceof Element && event.target.closest('a,button,input'))return
      if(window.matchMedia('(prefers-reduced-motion: reduce)').matches||!details.animate)return
      event.preventDefault()
      const old=animations.get(details),start=details.getBoundingClientRect().height
      const closing=old ? details.dataset.uxClosing!=='true' : details.open
      old?.cancel()
      details.style.overflow='hidden';details.style.height=`${start}px`
      details.open=true;details.dataset.uxClosing=String(closing)
      const style=getComputedStyle(details)
      const end=closing?summary.getBoundingClientRect().height + parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) + 2:details.scrollHeight + 2
      const animation=details.animate({height:[`${start}px`,`${end}px`]},{duration:220,easing:'cubic-bezier(.2,.7,.2,1)'})
      animations.set(details,animation)
      animation.onfinish=()=>{details.open=!closing;details.style.height='';details.style.overflow='';delete details.dataset.uxClosing;animations.delete(details)}
    }
    root.addEventListener('click',click)
    return ()=>{root.removeEventListener('click',click);window.removeEventListener('hashchange',revealHash);animations.forEach((a,d)=>{a.cancel();d.style.height='';d.style.overflow='';delete d.dataset.uxClosing})}
  },[path])
  return null
}
