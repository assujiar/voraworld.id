/** What each automatic email is called in the portal, and when it goes out. The keys are stored in the database and never shown. */
export const EVENT_LABEL: Record<string, { name: string; when: string }> = {
  lead_admin: { name: 'Pemberitahuan Lead baru ke admin', when: 'Setiap kali pengunjung mengirim form Contact atau RFQ' },
  lead_customer: { name: 'Konfirmasi permintaan ke pengunjung', when: 'Setelah pengunjung mengirim form Contact atau RFQ' },
  lead_reply: { name: 'Balasan ke Lead', when: 'Saat admin membalas Lead dari halaman Lead' },
  quotation_approval_request: { name: 'Permintaan persetujuan Quotation ke customer', when: 'Saat admin mengirim Quotation untuk ditandatangani customer' },
  quotation_customer_approved_admin: { name: 'Customer sudah mengunggah Quotation bertanda tangan (ke admin)', when: 'Setelah customer mengunggah dokumen; VORA belum memvalidasi' },
  quotation_validated_customer: { name: 'Quotation divalidasi VORA (ke customer)', when: 'Setelah admin menekan Validate Quotation' },
  quotation_approved_admin: { name: 'Persetujuan Quotation (versi lama, ke admin)', when: 'Tidak lagi dikirim oleh alur baru' },
  invoice_customer: { name: 'Invoice dan Pre-Payment Receipt ke customer', when: 'Saat admin menekan Kirim Invoice & Pre-Payment Receipt: satu email, dua PDF' },
  prepayment_receipt_customer: { name: 'Pre-Payment Receipt saja ke customer', when: 'Saat admin mengirim Pre-Payment Receipt terpisah' },
  payment_confirmed: { name: 'Pembayaran dikonfirmasi (ke customer)', when: 'Setelah admin menekan Konfirmasi Dana Diterima' },
  receipt_customer: { name: 'Official Payment Receipt ke customer', when: 'Setelah Receipt dirilis (dan e-meterai terpasang jika diperlukan)' },
  delivery_received_customer: { name: 'Bukti pengiriman ke penerima', when: 'Setelah sopir mencatat serah terima' },
  delivery_received_admin: { name: 'Pengiriman diterima (ke admin)', when: 'Setelah sopir mencatat serah terima' },
}

/** An email job's state, in words that do not promise more than is known: "sent" means the SMTP server accepted it, not that it was read. */
export const JOB_STATUS_LABEL: Record<string, string> = {
  queued: 'Masuk antrean', sending: 'Sedang dikirim', sent: 'Diterima server SMTP', retry: 'Gagal, akan dicoba lagi', failed: 'Gagal, percobaan habis',
}

export const eventName = (key: string) => EVENT_LABEL[key]?.name ?? 'Email otomatis'
