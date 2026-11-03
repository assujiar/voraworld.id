'use client'
import { useEffect, useRef, useState } from 'react'
import { makeT, type Locale } from '@/content'
import { publicSearchItems } from '@/content/public-ux'
import { rankSearch } from '@/lib/public-ux'

/** A real search link before hydration; a native, keyboard-contained dialog afterwards. */
export function PublicSearch({locale}: {locale:Locale}) {
  const t=makeT(locale), dialog=useRef<HTMLDialogElement>(null), trigger=useRef<HTMLElement|null>(null)
  const [query,setQuery]=useState(''),[enhanced,setEnhanced]=useState(false)
  const results=rankSearch(publicSearchItems(locale).filter(item=>item.category!=='FAQ'&&item.category!=='Field note'&&item.category!=='Catatan praktis'),query).slice(0,6)
  useEffect(()=>{
    const d=dialog.current
    if(!d)return
    setEnhanced(typeof d.showModal==='function')
    const closed=()=>{document.body.classList.remove('ux-search-open');trigger.current?.focus()}
    d.addEventListener('close',closed)
    return ()=>{d.removeEventListener('close',closed);document.body.classList.remove('ux-search-open')}
  },[])
  return <>
    {enhanced ? <button type="button" ref={node=>{trigger.current=node}} className="ux-search-trigger" aria-label={t('Search the website','Cari di website')} onClick={()=>{dialog.current?.showModal();document.body.classList.add('ux-search-open')}}><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg></button> : <a ref={node=>{trigger.current=node}} className="ux-search-trigger" href={`/${locale}/search`} aria-label={t('Search the website','Cari di website')}><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg></a>}
    <dialog ref={dialog} className="ux-search-dialog" aria-labelledby="ux-search-title" onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();dialog.current?.close()}}} onClick={e=>{if(e.target===e.currentTarget)dialog.current?.close()}}>
      <div className="ux-search-dialog__head"><h2 id="ux-search-title">{t('What are you looking for?','Apa yang Anda cari?')}</h2><button type="button" className="ux-icon-button" aria-label={t('Close search','Tutup pencarian')} onClick={()=>dialog.current?.close()}>×</button></div>
      <form action={`/${locale}/search`} method="get" role="search"><label htmlFor="ux-search-q">{t('Search services, FAQs and insights','Cari layanan, FAQ, dan artikel')}</label><div className="ux-search-row"><input autoFocus id="ux-search-q" type="search" name="q" maxLength={100} value={query} onChange={e=>setQuery(e.target.value)} placeholder={t('Try “shared truck”','Coba “muatan nggak penuh satu truk”')} autoComplete="off"/><button className="v-btn">{t('Search','Cari')}</button></div></form>
      {query.trim() ? <><p className="v-hint" role="status">{results.length ? t('Suggested pages below. Search to include published articles.','Saran halaman ada di bawah. Tekan Cari untuk menyertakan artikel yang sudah terbit.') : t('No quick match. Search to check published articles, or try a shorter phrase.','Belum ada saran yang cocok. Tekan Cari untuk menelusuri artikel, atau gunakan frasa lebih singkat.')}</p><ul className="ux-search-suggestions">{results.map(r=><li key={r.href}><a href={r.href} onClick={()=>dialog.current?.close()}><span>{r.category}</span>{r.title}<span aria-hidden="true">↗</span></a></li>)}</ul></> : <p className="v-muted">{t('Use your own words: customs clearance, a shared truck, storage or delivery documents.','Gunakan bahasa sehari-hari: bea cukai, truk gabungan, gudang, atau dokumen pengiriman.')}</p>}
    </dialog>
  </>
}
