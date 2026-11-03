import { makeT, type Locale } from '@/content'
/** Public wording for known refusals; database internals never become form copy. */
export function inquiryError(locale:Locale,reason?:string):string|undefined {
  if(!reason)return undefined
  const t=makeT(locale)
  if(reason.includes('Too many submissions'))return t('Several inquiries have already been sent from this email address. Please try again later, or reply to the confirmation email for an existing inquiry.','Beberapa permintaan sudah dikirim dari alamat email ini. Coba lagi nanti, atau balas email konfirmasi untuk menindaklanjuti permintaan yang sudah ada.')
  if(reason==='Consent required')return t('Please agree to the privacy notice before sending.','Centang persetujuan privasi sebelum mengirim.')
  if(reason==='Phone / WhatsApp number is required')return t('Enter your mobile number before sending.', 'Isi nomor HP Anda sebelum mengirim.')
  if(reason==='Enter a valid phone / WhatsApp number, for example +62 812 3456 7890')return t('Check your mobile number. Include the country code, for example +62 812 3456 7890.', 'Periksa nomor HP Anda. Cantumkan kode negara, misalnya +62 812 3456 7890.')
  if(reason==='Name, message and valid email are required')return t('Check your name, email address and message, then try again.','Periksa nama, alamat email, dan pesan Anda, lalu coba lagi.')
  if(reason==='Service, origin and destination required')return t('Choose a service and fill in the origin and destination.','Pilih layanan, lalu isi asal dan tujuan pengiriman.')
  return t('We could not complete the submission. Your draft is still here. Check the details and try again; if the problem continues, contact us by email.','Permintaan belum bisa dikirim. Draf Anda masih tersimpan. Periksa kembali isian dan coba lagi. Jika masih bermasalah, hubungi kami melalui email.')
}
