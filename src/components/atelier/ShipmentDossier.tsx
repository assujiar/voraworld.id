import { makeT, type Locale } from '@/content'
import { shipmentDossiers } from '@/content/shipment-dossiers'
import { serviceDesign } from '@/content/service-design'
import { ProcessRail } from './ProcessRail'
import { ObjectArt } from './ObjectArt'
export function ShipmentDossier({ locale, group, mode }: { locale: Locale; group: string; mode?: string }) {
  const t = makeT(locale), d = shipmentDossiers[mode ? `${group}/${mode}` : group]?.[locale]
  if (!d) return null
  const family = serviceDesign(group, mode).family
  return <section className={`a-dossier a-dossier--${family}`}>
    <div className="v-wrap">
      <div className="a-dossier__intro"><p className="a-label">{t('The operational brief', 'Dasar perencanaan')}</p><h2>{d.title}</h2><p>{d.body}</p></div>
      <div className="a-dossier__body">
        <ProcessRail locale={locale} steps={d.steps} />
        <aside className="a-cost"><span className="a-cost__index" aria-hidden="true">{family === 'heavy' ? '±' : '↗'}</span>{group === 'international-freight-forwarding' && mode === 'sea-export' ? <ObjectArt asset="reefer" className="a-cost__art" sizes="112px" /> : null}<h3>{d.costTitle}</h3><p>{d.costs}</p><details><summary>{t('What to send us', 'Data yang perlu disiapkan')}</summary><p>{d.prepare}</p></details></aside>
      </div>
      {family === 'warehouse' ? <div className="a-handling"><ObjectArt asset="forklift" /><div><p className="a-label">RECEIVE / STORE / DISPATCH</p><p>{t('Match storage and handling to the SKU profile, not an arbitrary floor-area target.', 'Cocokkan storage serta handling dengan profil SKU, bukan target luas tanpa dasar kebutuhan.')}</p></div></div> : null}
    </div>
  </section>
}
