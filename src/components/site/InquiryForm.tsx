import { makeT, serviceGroups, serviceModes, type Locale } from '@/content'
import { submitContact, submitQuote } from '@/actions/public'

export function InquiryForm({ locale, kind, mode }: { locale: Locale; kind: 'contact' | 'quote'; mode?: string }) {
  const t = makeT(locale)
  const quote = kind === 'quote'
  const page = `/${locale}/${quote ? 'request-quote' : 'contact'}`
  return (
    <form action={quote ? submitQuote : submitContact} {...(quote ? { 'data-vora-rfq': '' } : {})}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="_back" value={page} />
      <div className="hide"><label>Website<input name="website" autoComplete="off" tabIndex={-1} /></label></div>
      <div className="form-grid">
        <div className="field"><label>{t('Name', 'Nama')} *</label><input required name="name" maxLength={140} /></div>
        <div className="field"><label>Email *</label><input required name="email" type="email" maxLength={200} /></div>
        <div className="field"><label>{t('Company', 'Perusahaan')}</label><input name="company" maxLength={200} /></div>
        {quote ? (
          <>
            <div className="field">
              <label>{t('Service', 'Layanan')} *</label>
              <select name="mode" required defaultValue={mode ?? ''}>
                <option value="">{t('Select a service', 'Pilih layanan')}</option>
                {Object.entries(serviceGroups).map(([slug, group]) => (
                  <optgroup key={slug} label={group[locale].name}>
                    <option value={slug}>{group[locale].name} · {t('General inquiry', 'Inquiry umum')}</option>
                    {group.modes.map((m) => <option key={m} value={`${slug}/${m}`}>{serviceModes[slug][m][locale][0]}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="field"><label>{t('Pickup date', 'Tanggal penjemputan')}</label><input type="date" name="pickup" /></div>
            <div className="field"><label>{t('Origin', 'Asal')} *</label><input required name="origin" /></div>
            <div className="field"><label>{t('Destination', 'Tujuan')} *</label><input required name="destination" /></div>
            <div className="field wide"><label>{t('Cargo, equipment, weight, volume', 'Kargo, peralatan, berat, volume')}</label><textarea name="cargo" maxLength={6000} /></div>
          </>
        ) : null}
        <div className="field wide"><label>{t('Message', 'Pesan')} *</label><textarea required name="message" maxLength={6000} /></div>
        <div className="field wide">
          <label>
            <input type="checkbox" name="consent" value="yes" required style={{ width: 'auto', minHeight: 0 }} />{' '}
            {t('I agree to VORA using this information to respond to my inquiry under the', 'Saya setuju VORA menggunakan informasi ini untuk menanggapi permintaan saya sesuai')}{' '}
            <a href={`/${locale}/privacy`}>{t('privacy notice', 'pemberitahuan privasi')}</a>.
          </label>
        </div>
      </div>
      {quote ? (
        <div className="vora-rfq-summary" data-vora-rfq-summary data-filled="false">
          <small>{t('Inquiry overview · Not a quotation', 'Ringkasan permintaan · Bukan penawaran harga')}</small>
          <strong>{t('Choose a service and enter the shipment route.', 'Pilih layanan dan isi rute pengiriman.')}</strong>
        </div>
      ) : null}
      <button className="button" type="submit">{t('Send inquiry', 'Kirim permintaan')} ↗</button>
    </form>
  )
}
