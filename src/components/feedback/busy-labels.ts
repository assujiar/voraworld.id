/**
 * What a button says while its action is running, and when it asks before running. One table, so the same action reads the same everywhere.
 * The text is only ever shown while the server really is working: a button never says "done" here, the result arrives as a notice.
 */
export interface ConfirmSpec { title: string; body: string; action: string; danger?: boolean }

const norm = (s: string) => s.replace(/\s+/g, ' ').replace(/&amp;/g, '&').replace(/[↗→↑↓]/g, '').trim()

/** The visible text of a button's children (strings and numbers only; icons and elements are ignored). */
export function textOf(children: unknown): string {
  if (children == null || typeof children === 'boolean') return ''
  if (typeof children === 'string' || typeof children === 'number') return norm(String(children))
  if (Array.isArray(children)) return norm(children.map(textOf).join(' '))
  return ''
}

const RULES: Array<[RegExp, string]> = [
  [/^Simpan sebagai Customer & Buat Quotation/i, 'Membuat Customer dan Quotation…'],
  [/^Simpan sebagai Customer/i, 'Membuat Customer…'],
  [/^Save customer/i, 'Menyimpan Customer…'],
  [/^Save lead/i, 'Menyimpan Lead…'],
  [/^Save quotation draft/i, 'Membuat Quotation…'],
  [/^Save draft/i, 'Menyimpan draft…'],
  [/^Create invoice/i, 'Membuat Invoice dan Pre-Payment Receipt…'],
  [/^Issue invoice/i, 'Menerbitkan Invoice…'],
  [/^Issue quotation/i, 'Menerbitkan Quotation…'],
  [/^Issue delivery note/i, 'Menerbitkan Surat Jalan…'],
  [/^Issue document/i, 'Menerbitkan dokumen…'],
  [/^Validate Quotation/i, 'Memvalidasi Quotation…'],
  [/^Reject: needs correction/i, 'Mengembalikan Quotation…'],
  [/^Reject proof/i, 'Menolak bukti pengiriman…'],
  [/^Reject \/ cancel/i, 'Membatalkan klaim pembayaran…'],
  [/^Send quotation for customer approval|^Send again for customer approval/i, 'Menyiapkan email persetujuan…'],
  [/^Kirim Invoice & Pre-Payment Receipt/i, 'Memeriksa dokumen dan menyiapkan email…'],
  [/^Email pre-payment receipt/i, 'Menyiapkan email…'],
  [/^Send the receipt to the customer again/i, 'Menyiapkan email Receipt…'],
  [/^Email the proof to the consignee again/i, 'Menyiapkan email bukti pengiriman…'],
  [/^Send test email/i, 'Mengirim email uji…'],
  [/^Send reply/i, 'Menyiapkan balasan…'],
  [/^Send reset link/i, 'Menyiapkan tautan reset…'],
  [/^Process pending emails/i, 'Memproses antrean email…'],
  [/^Konfirmasi Dana Diterima/i, 'Mengonfirmasi Pembayaran…'],
  [/^Save payment/i, 'Menyimpan klaim pembayaran…'],
  [/^Save final stamped receipt/i, 'Memeriksa dan menyimpan Receipt…'],
  [/^Save final stamped pre-payment receipt/i, 'Memeriksa dan menyimpan Pre-Payment Receipt…'],
  [/^Submit for VORA review/i, 'Mengirim dokumen…'],
  [/^Create pre-payment receipt/i, 'Membuat Pre-Payment Receipt…'],
  [/^Void receipt and reverse payment/i, 'Membatalkan Receipt dan pembayaran…'],
  [/^Void pre-payment receipt/i, 'Membatalkan Pre-Payment Receipt…'],
  [/^Void/i, 'Membatalkan dokumen…'],
  [/^Publish page|^Publish\b|^Save & publish/i, 'Menerbitkan…'],
  [/^Unpublish/i, 'Menarik dari publikasi…'],
  [/^Save SMTP settings/i, 'Menyimpan pengaturan SMTP…'],
  [/^Save template/i, 'Menyimpan template email…'],
  [/^Save section/i, 'Menyimpan bagian…'],
  [/^Save details/i, 'Menyimpan data…'],
  [/^Add account/i, 'Menyimpan rekening…'],
  [/^Add (coverage|FAQ|item)/i, 'Menambahkan…'],
  [/^Create redirect/i, 'Membuat pengalihan…'],
  [/^Change password/i, 'Mengganti kata sandi…'],
  [/^Sign in/i, 'Memeriksa akun…'],
  [/^Log out/i, 'Keluar…'],
  [/^Retry/i, 'Mencoba kembali…'],
  [/^Restore/i, 'Memulihkan versi…'],
  [/^Set preferred/i, 'Mengubah rekening utama…'],
  [/^(Enable|Disable)/i, 'Mengubah aturan email…'],
  [/^(Deactivate|Reactivate)/i, 'Mengubah status…'],
  [/^Delete/i, 'Menghapus…'],
  [/^Update/i, 'Memperbarui…'],
  [/^Upload/i, 'Mengunggah file…'],
  [/^(Filter|Search|Cari)/i, 'Memuat daftar…'],
  [/^Continue/i, 'Memuat langkah berikutnya…'],
  [/^Send inquiry|^Kirim permintaan/i, 'Mengirim permintaan…'],
  [/^Save/i, 'Menyimpan…'],
  [/^Create/i, 'Membuat…'],
  [/^Send/i, 'Menyiapkan email…'],
]

/** The label for a running action. Falls back to a plain statement that names no result. */
export function busyLabel(text: string): string {
  const t = norm(text)
  for (const [re, label] of RULES) if (re.test(t)) return label
  return 'Memproses permintaan…'
}

/** While a file is going up the button names the file work, not the form. */
export function uploadLabel(text: string): string {
  const t = norm(text)
  if (/stamped|e-?meterai/i.test(t)) return 'Mengunggah dan memeriksa dokumen…'
  if (/Submit for VORA review/i.test(t)) return 'Mengunggah dokumen bertanda tangan…'
  if (/Upload/i.test(t)) return 'Mengunggah file…'
  return 'Mengunggah dokumen…'
}

const CONFIRMS: Array<[RegExp, ConfirmSpec]> = [
  [/^Validate Quotation/i, { title: 'Validasi Quotation ini?', body: 'Pastikan tanda tangan dan cap customer sudah diperiksa secara manual. Setelah divalidasi, Surat Jalan dan Invoice bisa dibuat dari Quotation ini, dan customer mendapat pemberitahuan bila aturan emailnya aktif.', action: 'Validasi Quotation' }],
  [/^Issue invoice/i, { title: 'Terbitkan Invoice ini?', body: 'Setelah diterbitkan, isi Invoice tidak bisa diubah lagi. Jika ada yang salah, Invoice harus dibatalkan lalu dibuat ulang.', action: 'Terbitkan Invoice' }],
  [/^Konfirmasi Dana Diterima/i, { title: 'Konfirmasi dana sudah diterima?', body: 'Pastikan dana benar-benar sudah masuk ke rekening PT Satu Arah International. Setelah dikonfirmasi, sisa tagihan dihitung ulang dan Official Receipt dibuat. Langkah ini tidak bisa diulang untuk pembayaran yang sama.', action: 'Konfirmasi Dana Diterima' }],
  [/^Void receipt and reverse payment/i, { title: 'Batalkan Receipt dan pembayarannya?', body: 'Receipt dibatalkan, pembayaran dikembalikan dan sisa tagihan Invoice dihitung ulang.', action: 'Batalkan Receipt', danger: true }],
  [/^Void pre-payment receipt/i, { title: 'Batalkan Pre-Payment Receipt?', body: 'Dokumen ini tidak lagi berlaku dan tautan verifikasinya dicabut.', action: 'Batalkan Pre-Payment Receipt', danger: true }],
  [/^Void/i, { title: 'Batalkan dokumen ini?', body: 'Dokumen tidak lagi berlaku dan tautan verifikasinya dicabut. Catatan riwayatnya tetap tersimpan.', action: 'Batalkan dokumen', danger: true }],
  [/^Reject \/ cancel/i, { title: 'Batalkan klaim pembayaran ini?', body: 'Klaim pembayaran dibatalkan. Saldo Invoice tidak berubah.', action: 'Batalkan klaim', danger: true }],
  [/^Reject proof/i, { title: 'Tolak bukti pengiriman?', body: 'Surat Jalan kembali ke status diterbitkan dan QR code bisa dipakai lagi. Tulis alasannya di kolom sebelumnya.', action: 'Tolak bukti', danger: true }],
  [/^Delete/i, { title: 'Hapus data ini?', body: 'Data yang dihapus tidak bisa dikembalikan dari layar ini.', action: 'Hapus', danger: true }],
  [/^Deactivate/i, { title: 'Nonaktifkan?', body: 'Akses atau tampilan terkait dihentikan sampai diaktifkan kembali.', action: 'Nonaktifkan', danger: true }],
]

export function confirmFor(text: string): ConfirmSpec | undefined {
  const t = norm(text)
  return CONFIRMS.find(([re]) => re.test(t))?.[1]
}
