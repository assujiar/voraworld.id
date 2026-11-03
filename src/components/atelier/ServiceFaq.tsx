import { makeT, type Locale } from '@/content'
import { shipmentDossiers } from '@/content/shipment-dossiers'
import { jsonLd } from '@/lib/metadata'
export function ServiceFaq({ locale, group, mode }: { locale: Locale; group: string; mode?: string }) {
  const t=makeT(locale), d=shipmentDossiers[mode ? `${group}/${mode}` : group]?.[locale]
  if(!d)return null
  const items=[{q:t('What details are needed for an assessment?', 'Data apa yang diperlukan untuk penilaian?'),a:d.prepare},{q:t('What affects the quotation?', 'Apa yang memengaruhi penawaran?'),a:d.costs}]
  return <section className="v-section v-section--bone" id="service-faq"><div className="v-wrap v-faq"><div><p className="a-label">{t('Before you request a quote', 'Sebelum meminta penawaran')}</p><h2 className="v-h2">{t('Two useful questions.', 'Dua hal yang perlu dipastikan.')}</h2></div><div className="v-faq__list">{items.map(i=><details key={i.q}><summary>{i.q}</summary><p>{i.a}</p></details>)}</div></div><script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLd({'@context':'https://schema.org','@type':'FAQPage',inLanguage:locale,mainEntity:items.map(i=>({'@type':'Question',name:i.q,acceptedAnswer:{'@type':'Answer',text:i.a}}))})}} /></section>
}
