import { makeT, serviceGroups, serviceModes, type Locale } from '@/content'
import { rfqGuidance } from '@/content/rfq-guidance'
import { submitContact, submitQuote } from '@/actions/public'
import { AsyncButton } from '@/components/feedback/AsyncButton'
import { PendingForm } from '@/components/feedback/scope'
import { KeepFields } from './KeepFields'
import { RfqGuidance } from './RfqGuidance'
import { FormAssist } from './FormAssist'
import { Glossary } from './ServiceTools'

/** One field: the label is tied to the control (`htmlFor`/`id`), the hint and the form's error are announced with it (`aria-describedby`). */
function Field({ id, label, required, hint, why, whyLabel, wide, children }: { id: string; label: string; required?: boolean; hint?: string; why?: string; whyLabel?: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={`field${wide ? ' wide' : ''}`}>
      <label htmlFor={id}>{label}{required ? <span aria-hidden="true"> *</span> : null}</label>
      {children}
      <p className="ux-field-error" id={`${id}-error`} hidden />
      {why ? <details className="ux-field-why"><summary>{whyLabel}</summary><p>{why}</p></details> : null}
      {hint ? <p className="v-hint" id={`${id}-hint`}>{hint}</p> : null}
    </div>
  )
}

export function InquiryForm({ locale, kind, mode, error }: { locale: Locale; kind: 'contact' | 'quote'; mode?: string; error?: string }) {
  const t = makeT(locale)
  const quote = kind === 'quote'
  const page = `/${locale}/${quote ? 'request-quote' : 'contact'}`
  const p = quote ? 'rfq' : 'contact'                                    // ids are unique per page and stable between renders
  const d = (id: string, hasHint = false) => [`${id}-error`, hasHint ? `${id}-hint` : '', error ? 'form-error' : ''].filter(Boolean).join(' ') || undefined
  const parts = mode?.split('/') ?? []
  const known = parts.length === 1 ? (serviceGroups[parts[0]] ? mode : '') : parts.length === 2 && serviceModes[parts[0]]?.[parts[1]] ? mode : ''
  const group = (slug: string, key: 'en' | 'id') => serviceGroups[slug][key].name
  return (
    <PendingForm preserveValues action={quote ? submitQuote : submitContact} id={`${p}-form`} connectionLost={t('The connection was interrupted before the server replied. Your details are still here. Check your email for the inquiry confirmation before trying again.', 'Koneksi terputus sebelum server memberikan jawaban. Isian Anda masih ada. Periksa email konfirmasi permintaan sebelum mencoba mengirim lagi.')}>
      <KeepFields formId={`${p}-form`} storageKey={`vora:${p}:${locale}`} />
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="_back" value={page} />
      <div className="hide" aria-hidden="true"><label>Website<input name="website" autoComplete="off" tabIndex={-1} /></label></div>

      <fieldset className="v-fieldset">
        <legend>{t('Your details', 'Data Anda')}</legend>
        <div className="form-grid">
          <Field id={`${p}-name`} label={t('Name', 'Nama')} required>
            <input id={`${p}-name`} required name="name" maxLength={140} autoComplete="name" aria-describedby={d(`${p}-name`)} />
          </Field>
          <Field id={`${p}-email`} label="Email" required whyLabel={t('Why we ask', 'Untuk apa data ini?')} why={t('We use this address for the inquiry confirmation and our reply. Check it before sending.', 'Alamat ini digunakan untuk konfirmasi permintaan dan balasan tim. Periksa kembali sebelum mengirim.') }>
            <input id={`${p}-email`} required name="email" type="email" maxLength={200} autoComplete="email" inputMode="email" aria-describedby={d(`${p}-email`)} />
          </Field>
          <Field id={`${p}-phone`} label={t('Mobile number', 'Nomor HP')} required
            hint={t('Include your country code, for example +62 812 3456 7890.', 'Cantumkan kode negara, misalnya +62 812 3456 7890.')}
            whyLabel={t('Why we ask', 'Untuk apa data ini?')}
            why={t('We use this number to follow up on your inquiry.', 'Nomor ini digunakan tim untuk menindaklanjuti permintaan Anda.')}>
            <input id={`${p}-phone`} required name="phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={40} minLength={7}
              pattern="\+?[0-9][0-9\s\(\)\.\-]{4,28}[0-9]" placeholder="+62 812 3456 7890" aria-describedby={d(`${p}-phone`, true)} />
          </Field>
          <Field id={`${p}-company`} label={t('Company', 'Perusahaan')}>
            <input id={`${p}-company`} name="company" maxLength={200} autoComplete="organization" aria-describedby={d(`${p}-company`)} />
          </Field>
        </div>
      </fieldset>

      {quote ? (
        <>
          <fieldset className="v-fieldset">
            <legend>{t('The shipment', 'Pengiriman')}</legend>
            <div className="form-grid">
              <Field id="rfq-mode" label={t('Service', 'Layanan')} required wide whyLabel={t('Not sure which service?', 'Belum tahu pilih layanan apa?')} why={t('Choose the broad service group if you are unsure of the mode. The team will review the arrangement with you.', 'Pilih kelompok layanan umum jika belum tahu modanya. Tim akan membantu meninjau pengaturan yang sesuai.') }>
                <select id="rfq-mode" name="mode" required defaultValue={known} aria-describedby={d('rfq-mode')}>
                  <option value="">{t('Select a service', 'Pilih layanan')}</option>
                  {Object.entries(serviceGroups).map(([slug, g]) => (
                    <optgroup key={slug} label={g[locale].name}>
                      <option value={slug}>{g[locale].name} · {t('General inquiry', 'Permintaan umum')}</option>
                      {g.modes.map((m) => <option key={m} value={`${slug}/${m}`}>{serviceModes[slug][m][locale][0]}</option>)}
                    </optgroup>
                  ))}
                </select>
                <p className="v-hint"><a className="v-link" href={`/${locale}/services#service-help`}>{t('Help me choose a service', 'Bantu saya memilih layanan')}</a></p>
              </Field>
              <Field id="rfq-origin" label={t('Origin', 'Asal')} required hint={t('City and country, or the port or airport.', 'Kota dan negara, atau pelabuhan atau bandara.')}>
                <input id="rfq-origin" required name="origin" maxLength={160} autoComplete="off" aria-describedby={d('rfq-origin', true)} />
              </Field>
              <Field id="rfq-destination" label={t('Destination', 'Tujuan')} required hint={t('City and country, or the port or airport.', 'Kota dan negara, atau pelabuhan atau bandara.')}>
                <input id="rfq-destination" required name="destination" maxLength={160} autoComplete="off" aria-describedby={d('rfq-destination', true)} />
              </Field>
              <Field id="rfq-pickup" label={t('Cargo ready date', 'Tanggal barang siap')} wide whyLabel={t('Why we ask', 'Untuk apa data ini?')} why={t('The ready date helps us check cut-offs and plan collection. It does not make a booking.', 'Tanggal siap membantu pengecekan cut-off dan perencanaan penjemputan. Isian ini belum menjadi pemesanan.')} hint={t('An approximate date is fine.', 'Perkiraan tanggal sudah cukup.')}>
                <input id="rfq-pickup" type="date" name="pickup" aria-describedby={d('rfq-pickup', true)} />
              </Field>
            </div>
          </fieldset>
          <fieldset className="v-fieldset">
            <legend>{t('The cargo', 'Barang')}</legend>
            <div className="form-grid">
              <Field id="rfq-cargo" label={t('Cargo description', 'Deskripsi barang')} required wide whyLabel={t('What details help?', 'Detail apa yang dibutuhkan?')} why={t('Describe the goods, packing, package dimensions and gross weight. These help check capacity, handling and the charging basis. Mention batteries, liquids or other special requirements.', 'Jelaskan jenis barang, kemasan, dimensi tiap kemasan, dan berat kotor. Data ini membantu pemeriksaan kapasitas, handling, dan dasar biaya. Sebutkan baterai, cairan, atau kebutuhan khusus lainnya.') }>
                <textarea id="rfq-cargo" required name="cargo" rows={5} maxLength={6000} aria-describedby={d('rfq-cargo') ? `rfq-guidance ${d('rfq-cargo')}` : 'rfq-guidance'} />
              </Field>
              <div className="field wide">
                <RfqGuidance selectId="rfq-mode" title={t('Useful to include', 'Sebaiknya dicantumkan')}
                  groups={Object.fromEntries(Object.entries(rfqGuidance).filter(([k]) => k !== '_default').map(([k, v]) => [k, v[locale]]))} fallback={rfqGuidance._default[locale]} />
              </div>
            </div>
          </fieldset>
          <Glossary locale={locale} terms={['CBM','Chargeable weight','FTL','LTL','FCL','LCL']} />
        </>
      ) : null}

      <fieldset className="v-fieldset">
        <legend>{quote ? t('Anything else', 'Informasi tambahan') : t('Your message', 'Pesan Anda')}</legend>
        <div className="form-grid">
          <Field id={`${p}-message`} label={quote ? t('Additional instructions', 'Instruksi tambahan') : t('Message', 'Pesan')} required={!quote} wide
            hint={quote ? t('Optional: special handling, documents you already have, a budget or deadline. If you leave it empty, the cargo description is used.', 'Opsional: penanganan khusus, dokumen yang sudah ada, anggaran atau tenggat. Bila kosong, deskripsi barang yang dipakai.') : undefined}>
            <textarea id={`${p}-message`} required={!quote} name="message" rows={quote ? 3 : 6} maxLength={6000} aria-describedby={d(`${p}-message`, quote)} />
          </Field>
          <div className="field wide v-consent">
            <input id={`${p}-consent`} type="checkbox" name="consent" value="yes" required aria-describedby={d(`${p}-consent`)} />
            <label htmlFor={`${p}-consent`}>
              {t('I agree to VORA using this information to respond to my inquiry under the', 'Saya setuju VORA menggunakan informasi ini untuk menanggapi permintaan saya sesuai')}{' '}
              <a href={`/${locale}/privacy`}>{t('privacy notice', 'pemberitahuan privasi')}</a>.
            </label>
          </div>
          <p className="ux-field-error wide" id={`${p}-consent-error`} hidden />
        </div>
      </fieldset>
      <FormAssist formId={`${p}-form`} locale={locale} quote={quote} />
      <AsyncButton className="v-btn" busy={t('Sending your inquiry…', 'Mengirim permintaan Anda…')}>{t('Send inquiry', 'Kirim permintaan')}</AsyncButton>
    </PendingForm>
  )
}
