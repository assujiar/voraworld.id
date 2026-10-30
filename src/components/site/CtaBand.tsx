import { makeT, siteText, type Locale } from '@/content'
import { getSettings } from '@/server/site'

/** The close of a page: how to reach VORA, in plain words. */
export async function CtaBand({ locale }: { locale: Locale }) {
  const t = makeT(locale)
  const settings = await getSettings()
  return (
    <section className="v-section v-section--bone">
      <div className="v-wrap v-close" style={{ padding: 0 }}>
        <div>
          <h2 className="v-h2">{t('Tell us the cargo, the route and the date.', 'Beri tahu kami barang, rute, dan tanggalnya.')}</h2>
          <div className="v-actions">
            <a className="v-btn" href={`/${locale}/request-quote`}>{siteText[locale].rfq}</a>
            <a className="v-link" href={`/${locale}/contact`}>{t('Or write to us', 'Atau tulis kepada kami')}</a>
          </div>
        </div>
        <address>
          {settings.email ? <a className="v-mail" href={`mailto:${settings.email}`}>{settings.email}</a> : null}
          {settings.address ? <p style={{ marginTop: 14 }} className="v-muted">{settings.address}</p> : null}
        </address>
      </div>
    </section>
  )
}
