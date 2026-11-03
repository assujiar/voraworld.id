import { makeT } from '@/content'
import { documentSamples, sampleNotice } from '@/content/document-samples'
import { pageMetadata } from '@/lib/metadata'
import { localeOf, type LocaleParams } from '@/lib/page'
export async function generateMetadata({params}:LocaleParams){
  const locale=await localeOf(params),t=makeT(locale)
  return pageMetadata({locale,path:'/document-samples',title:t('Sample shipment documents | VORA','Contoh dokumen pengiriman | VORA'),description:t('See what to look for in a quotation, delivery note and proof of delivery.','Kenali informasi dalam penawaran, surat jalan, dan bukti serah terima.')})
}
export default async function DocumentSamples({params}:LocaleParams){
  const locale=await localeOf(params),t=makeT(locale)
  return <section className="v-section ux-document-page"><div className="v-wrap"><p className="a-label">{t('Documents, explained','Kenali dokumen pengiriman')}</p><h1 className="v-h2">{t('Know what you are reading.','Pahami dokumen yang Anda terima.')}</h1><p className="a-intro">{t('Three examples to help you check scope, cargo details and handover records. Issued documents follow the agreed service and recorded information.','Tiga contoh untuk membantu Anda memeriksa cakupan, detail barang, dan catatan serah terima. Dokumen yang diterbitkan mengikuti layanan yang disepakati dan data yang tercatat.')}</p><p className="ux-sample-notice">{sampleNotice[locale]}</p>
    <div className="ux-document-grid">{documentSamples.map(sample=><article key={sample.key} className="ux-sample"><header><span className="ux-eyebrow">{t('Sample document','Contoh dokumen')}</span><h2>{sample[locale].title}</h2><p>{sample[locale].purpose}</p></header><dl>{sample[locale].sections.map(([title,body])=><div key={title}><dt>{title}</dt><dd>{body}</dd></div>)}</dl><a className="v-link" download href={`/samples/${sample.key}-${locale}.pdf`}>{t('Download sample PDF','Unduh PDF contoh')} <span aria-hidden="true">↓</span></a></article>)}</div>
    <p className="v-note">{t('Checking a document you received? Use the verification link on that issued document.','Ingin memeriksa dokumen yang Anda terima? Gunakan tautan verifikasi pada dokumen tersebut.')}</p><a className="v-btn" href={`/${locale}/contact`}>{t('Ask about a document','Tanyakan dokumen')}</a>
  </div></section>
}
