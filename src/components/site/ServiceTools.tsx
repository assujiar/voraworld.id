'use client'
import { useState } from 'react'
import { makeT, serviceGroups, serviceModes, type Locale } from '@/content'
import { comparisonOptions, glossary } from '@/content/public-ux'
import { suggestedServices, type Need, type Arrangement } from '@/lib/public-ux'

export function Glossary({ locale, terms = Object.keys(glossary) }: { locale:Locale; terms?:string[] }) {
  const t = makeT(locale)
  return <aside className="ux-glossary" aria-label={t('Logistics terms explained', 'Arti istilah logistik')}><p className="ux-eyebrow">{t('Need a term explained?', 'Ada istilah yang belum familiar?')}</p><div>{terms.filter(term => term in glossary).map(term => <details key={term} className="ux-term"><summary>{term === 'Chargeable weight' && locale === 'id' ? 'Berat yang ditagihkan' : term === 'HS code' && locale === 'id' ? 'Kode HS' : term}</summary><p>{glossary[term as keyof typeof glossary][locale]}</p></details>)}</div></aside>
}

export function ServiceTools({locale}: {locale:Locale}) {
  const t = makeT(locale)
  const [need,setNeed]=useState<Need | ''>(''), [arrangement,setArrangement]=useState<Arrangement>('unsure'), [shared,setShared]=useState('unsure')
  const [left,setLeft]=useState(comparisonOptions[0].key),[right,setRight]=useState(comparisonOptions[1].key)
  const pair=[comparisonOptions.find(c=>c.key===left)!,comparisonOptions.find(c=>c.key===right)!]
  const title=(key:string) => { const [g,m]=key.split('/'); return m ? serviceModes[g][m][locale][0] : serviceGroups[g][locale].name }
  const recommended=need ? suggestedServices(need,arrangement,shared) : []
  return <section className="v-section v-section--tight ux-service-tools" id="service-help"><div className="v-wrap">
    <div className="ux-tools-head"><p className="a-label">{t('A little help choosing', 'Bantu tentukan pilihan')}</p><h2 className="v-h2 v-h2--section">{t('Describe the job. Then compare the options.', 'Mulai dari kebutuhannya, lalu bandingkan pilihannya.')}</h2></div>
    <details className="ux-disclosure"><summary>{t('Help me find a service', 'Bantu saya memilih layanan')}</summary><div className="ux-disclosure__body">
      <p className="v-muted">{t('A few questions to find a starting point. We will confirm suitability after reviewing your cargo.', 'Jawab beberapa pertanyaan untuk menentukan pilihan awal. Kesesuaiannya akan kami pastikan setelah meninjau detail barang.')}</p>
      <fieldset className="ux-choice"><legend>{t('What do you need help with?', 'Apa yang Anda butuhkan?')}</legend><div>{([
        ['domestic', t('Move cargo within Indonesia', 'Kirim barang di dalam Indonesia')],['international',t('Ship to or from another country','Kirim barang dari atau ke luar negeri')],['customs',t('Arrange customs clearance','Urus kepabeanan')],['warehouse',t('Store or fulfil orders','Simpan barang atau proses pesanan')],['project',t('Move heavy or oversized cargo','Pindahkan barang berat atau berdimensi besar')],
      ] as [Need,string][]).map(([value,label])=><label key={value}><input type="radio" name="ux-need" value={value} checked={need===value} onChange={()=>{setNeed(value);setArrangement('unsure');setShared('unsure')}}/><span>{label}</span></label>)}</div></fieldset>
      {need==='domestic' ? <fieldset className="ux-choice"><legend>{t('Do you have a transport mode in mind?', 'Sudah ada pilihan angkutan?')}</legend><div>{([['road',t('By road','Darat')],['sea',t('By sea','Laut')],['air',t('By air','Udara')],['unsure',t('Help me decide','Belum tahu')]] as [Arrangement,string][]).map(([value,label])=><label key={value}><input type="radio" name="ux-arrangement" checked={arrangement===value} onChange={()=>{setArrangement(value);setShared('unsure')}}/><span>{label}</span></label>)}</div></fieldset> : null}
      {need==='domestic' && (arrangement==='road'||arrangement==='sea') ? <fieldset className="ux-choice"><legend>{t('Dedicated capacity or a shared load?', 'Kapasitas khusus atau muatan gabungan?')}</legend><div>{[['dedicated',t('Dedicated to my shipment','Khusus untuk kiriman saya')],['shared',t('Shared with other shipments','Gabung dengan kiriman lain')],['unsure',t('I need to compare','Ingin bandingkan dulu')]].map(([value,label])=><label key={value}><input type="radio" name="ux-shared" checked={shared===value} onChange={()=>setShared(value)}/><span>{label}</span></label>)}</div></fieldset> : null}
      <div className="ux-recommendation" aria-live="polite" aria-atomic="true">{recommended.length ? <><h3>{t('Start here', 'Mulai dari sini')}</h3><ul>{recommended.map(key=><li key={key}><a className="v-link" href={`/${locale}/services/${key}`}>{title(key)} <span aria-hidden="true">↗</span></a></li>)}</ul><p>{t('Send dimensions, weight, packing and the route so the team can check the arrangement.', 'Kirim dimensi, berat, kemasan, dan rutenya agar tim dapat menilai pengaturan yang sesuai.')}</p></> : <p>{t('Choose a need to see the relevant services.', 'Pilih kebutuhan Anda untuk melihat layanan yang relevan.')}</p>}</div>
    </div></details>
    <details className="ux-disclosure" id="compare-services"><summary>{t('Compare two services', 'Bandingkan dua layanan')}</summary><div className="ux-disclosure__body">
      <div className="ux-compare-selects">{pair.map((c,i)=><div key={i}><label htmlFor={`compare-${i}`}>{i===0?t('First service','Layanan pertama'):t('Second service','Layanan kedua')}</label><select id={`compare-${i}`} value={c.key} onChange={e=>{ const key=e.target.value; if(i===0){setLeft(key);if(key===right)setRight(left)}else{setRight(key);if(key===left)setLeft(right)} }}>{comparisonOptions.map(o=><option key={o.key} value={o.key}>{o.title[locale]}</option>)}</select></div>)}</div>
      <p role="status" className="sr-only">{t(`Comparing ${pair[0].title.en} and ${pair[1].title.en}.`, `Membandingkan ${pair[0].title.id} dengan ${pair[1].title.id}.`)}</p><div className="ux-comparison"><div className="ux-comparison__titles"><span/><h3><a href={`/${locale}/services/${left}`}>{pair[0].title[locale]}</a></h3><h3><a href={`/${locale}/services/${right}`}>{pair[1].title[locale]}</a></h3></div><dl>{([
        ['fit',t('Useful for','Sesuai untuk')],['handling',t('Handling and scope','Handling dan cakupan')],['tradeoff',t('Planning considerations','Yang perlu dipertimbangkan')],['prepare',t('Have ready','Data yang perlu disiapkan')],
      ] as const).map(([key,label])=><div key={key}><dt>{label}</dt>{pair.map(c=><dd key={c.key}><span className="sr-only">{c.title[locale]}: </span>{c[key][locale]}</dd>)}</div>)}</dl></div>
      <p className="v-hint">{t('These are service characteristics, not a rate comparison. The quotation depends on the route, cargo and agreed scope.', 'Perbandingan ini menjelaskan karakter layanan, bukan tarif. Penawaran bergantung pada rute, barang, dan cakupan yang disepakati.')}</p>
    </div></details>
    <Glossary locale={locale}/>
  </div></section>
}
