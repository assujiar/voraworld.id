'use client'
import { useEffect, useState } from 'react'
import { makeT, type Locale } from '@/content'
import { DRAFT_FIELDS, fieldError } from '@/lib/public-ux'
import { useScope } from '@/components/feedback/scope'

type Field = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
export function FormAssist({ formId, locale, quote }: {formId:string;locale:Locale;quote:boolean}) {
  const t=makeT(locale),scope=useScope()
  const [values,setValues]=useState<Record<string,string>>({}),[missing,setMissing]=useState<{id:string;label:string}[]>([])
  const [ready,setReady]=useState(false),[cleared,setCleared]=useState(false)
  useEffect(()=>{
    const form=document.getElementById(formId) as HTMLFormElement|null
    if(!form)return
    const fields=[...form.querySelectorAll<Field>('input,textarea,select')].filter(f=>DRAFT_FIELDS.includes(f.name as typeof DRAFT_FIELDS[number])||f.name==='consent')
    const touched=new Set<string>()
    const sync=()=>{
      const next:Record<string,string>={},todo:{id:string;label:string}[]=[]
      for(const field of fields){
        const error=fieldError(field.name,field.value,field.required,locale,field instanceof HTMLInputElement && field.checked)
        field.setCustomValidity(error)
        if(field.name!=='consent') next[field.name]=field instanceof HTMLSelectElement ? field.value ? field.selectedOptions[0]?.textContent??'' : '' : field.value
        if(error || !field.validity.valid) todo.push({id:field.id,label:field.name==='consent' ? t('Privacy consent','Persetujuan privasi') : form.querySelector(`label[for="${field.id}"]`)?.textContent?.replace(/\s*\*$/,'')??field.name})
        const message=document.getElementById(`${field.id}-error`)
        const show=touched.has(field.id) && (error||(!field.validity.valid?field.validationMessage:''))
        if(message){message.textContent=show||'';message.hidden=!show}
        if(show)field.setAttribute('aria-invalid','true');else field.removeAttribute('aria-invalid')
      }
      setValues(next);setMissing(todo);setReady(true)
    }
    const edit=()=>{setCleared(false);sync()}
    const blur=(e:Event)=>{const field=e.target as Field;if(fields.includes(field)){touched.add(field.id);sync()}}
    const clear=()=>{touched.clear();sync()}
    sync()
    form.addEventListener('input',edit);form.addEventListener('change',edit);form.addEventListener('focusout',blur);form.addEventListener('invalid',blur,true);form.addEventListener('vora:draft-restored',sync);form.addEventListener('vora:draft-clear',clear)
    return ()=>{form.removeEventListener('input',edit);form.removeEventListener('change',edit);form.removeEventListener('focusout',blur);form.removeEventListener('invalid',blur,true);form.removeEventListener('vora:draft-restored',sync);form.removeEventListener('vora:draft-clear',clear);fields.forEach(f=>f.setCustomValidity(''))}
  // The effect follows locale and form identity, not the locale-bound copy function.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[formId,locale])
  if(!ready)return null
  const go=(id:string)=>document.getElementById(id)?.focus()
  return <div className="ux-form-assist">
    {quote ? <details className="ux-disclosure"><summary>{t('Review your shipment brief','Periksa ringkasan pengiriman')}</summary><div className="ux-disclosure__body"><p className="v-hint">{t('This summary uses only what you entered. Open a field to make a change.','Ringkasan ini hanya menampilkan isian Anda. Pilih bagian yang ingin diubah.')}</p><dl className="ux-brief">{[
      ['mode',t('Service','Layanan')],['origin',t('Origin','Asal')],['destination',t('Destination','Tujuan')],['pickup',t('Cargo ready date','Tanggal barang siap')],['cargo',t('Cargo description','Deskripsi barang')],['message',t('Additional instructions','Instruksi tambahan')],
    ].map(([key,label])=><div key={key}><dt><a href={`#rfq-${key}`} onClick={()=>go(`rfq-${key}`)}>{label}</a></dt><dd>{values[key]?.trim()||t('Not provided','Belum diisi')}</dd></div>)}</dl></div></details> : null}
    <details className="ux-disclosure"><summary>{t('Check the required fields','Periksa bagian wajib')}</summary><div className="ux-disclosure__body"><p role="status">{ready ? missing.length ? t(`${missing.length} required ${missing.length===1 ? 'field still needs' : 'fields still need'} attention.`,`${missing.length} bagian wajib masih perlu dilengkapi atau diperbaiki.`) : t('The required fields are complete. You can review the details and send your inquiry.','Bagian wajib sudah lengkap. Periksa kembali detailnya, lalu kirim permintaan Anda.') : t('Checking the form…','Memeriksa isian…')}</p>{missing.length ? <ul className="ux-missing">{missing.map(f=><li key={f.id}><a href={`#${f.id}`} onClick={()=>go(f.id)}>{f.label}</a></li>)}</ul> : null}<p className="v-hint">{t('This checks form completeness. The team still needs to review the shipment and scope.','Pemeriksaan ini hanya menilai kelengkapan formulir. Detail pengiriman dan cakupannya tetap perlu ditinjau tim.')}</p></div></details>
    <div className="ux-draft-note"><p className="v-hint">{t('Your draft stays in this tab for up to four hours, including when you switch languages. It is cleared after sending. Privacy consent is never saved.','Draf tersimpan di tab ini selama maksimal empat jam, termasuk saat berganti bahasa. Draf dihapus setelah terkirim. Persetujuan privasi tidak pernah disimpan.')}</p><button type="button" className="ux-small-button" disabled={scope.pending} onClick={()=>{const form=document.getElementById(formId) as HTMLFormElement;form.reset();form.dispatchEvent(new Event('vora:draft-clear'));setCleared(true)}}>{t('Clear draft','Hapus draf')}</button><span role="status" className="v-hint">{cleared?t('Draft cleared.','Draf sudah dihapus.'):''}</span></div>
  </div>
}
