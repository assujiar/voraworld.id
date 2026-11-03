'use client'
import { useEffect, useRef, useState } from 'react'
import { makeT, type Locale } from '@/content'
export function CopyControl({value,locale,label}:{value:string;locale:Locale;label:string}) {
  const t=makeT(locale),[status,setStatus]=useState(''),timer=useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current)},[])
  return <span className="ux-copy"><button type="button" className="ux-small-button" aria-label={label} onClick={async()=>{if(timer.current)clearTimeout(timer.current);try{await navigator.clipboard.writeText(value);setStatus(t('Copied','Tersalin'))}catch{setStatus(t('Could not copy. Select and copy the text above.','Belum bisa disalin. Pilih dan salin teks di atas.'))}timer.current=setTimeout(()=>setStatus(''),4000)}}>{t('Copy','Salin')}</button><span role="status" className="v-hint">{status}</span></span>
}
