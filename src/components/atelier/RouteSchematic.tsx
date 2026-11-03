import { makeT, type Locale } from '@/content'
export function RouteSchematic({ locale }: { locale: Locale }) {
  const t = makeT(locale)
  return <figure className="a-route-map">
    <div className="a-route-map__point" data-assembly><span>01</span><strong>{t('Origin', 'Asal')}</strong><p>{t('Cargo ready · export handover', 'Barang siap · serah terima ekspor')}</p></div>
    <div className="a-route-map__line" aria-hidden="true"><i /><i /><i /></div>
    <div className="a-route-map__point" data-assembly><span>02</span><strong>{t('Main carriage', 'Angkutan utama')}</strong><p>{t('Air / ocean / road', 'Udara / laut / darat')}</p></div>
    <div className="a-route-map__line" aria-hidden="true"><i /><i /><i /></div>
    <div className="a-route-map__point" data-assembly><span>03</span><strong>{t('Destination', 'Tujuan')}</strong><p>{t('Release · onward delivery', 'Release · pengantaran lanjutan')}</p></div>
    <figcaption>{t('Routing logic, not a map of owned offices or a live shipment.', 'Skema rute, bukan peta kantor milik VORA atau posisi shipment aktual.')}</figcaption>
  </figure>
}
