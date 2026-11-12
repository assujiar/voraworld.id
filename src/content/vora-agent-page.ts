import type { Locale } from './index'

/**
 * The public page for VORA Agent (/en/vora-agent, /id/vora-agent). Every statement follows what the agent is instructed to do in
 * server/agent/knowledge.ts: answer logistics questions, point to Request a Quote, forward a summary to the team on request, and never
 * track shipments, quote live rates or confirm a price, booking, permit or transit time.
 */
export const voraAgentPage: Record<Locale, {
  title: string; description: string; label: string; h1: string; intro: string; keep: string; fallback: string
  examplesTitle: string; examplesHint: string; examples: string[]
  limitsTitle: string; limits: string[]; teamTitle: string; team: string; rfq: string
}> = {
  en: {
    title: 'VORA Agent: AI help for freight and logistics questions | VORA',
    description: 'Ask VORA Agent about freight, customs, domestic distribution, project cargo or warehousing, and prepare the details a quotation needs. Chat while you browse.',
    label: 'VORA / VIRTUAL AGENT',
    h1: 'Ask VORA Agent about your shipment.',
    intro: 'VORA Agent is the AI assistant on this website. Ask it about international freight, customs, domestic distribution, project cargo or warehousing, and it will help you work out the details a quotation needs.',
    keep: 'Minimize the chat to keep it in the corner of the screen while you read other pages. The conversation continues from your last message. On a phone it waits behind the Ask VORA button.',
    fallback: 'The chat is loading. If it does not appear, use Request a Quote or email info@voraworld.id.',
    examplesTitle: 'Questions you can start with',
    examplesHint: 'Choose a question to put it in the chat.',
    examples: [
      'What details do I need for a sea freight quote?',
      'What is the difference between FCL and LCL?',
      'Which documents does customs clearance usually need?',
      'How is chargeable weight calculated for air freight?',
    ],
    limitsTitle: 'What it cannot do',
    limits: [
      'VORA Agent cannot track a shipment, check live rates or carrier space, or confirm a price, booking, permit or transit time. Those come from the VORA team in a written quotation.',
      'AI answers can be wrong. Do not share passwords, bank details or identity documents in the chat.',
    ],
    teamTitle: 'When you want the team to follow up',
    team: 'Before the first message, the agent asks for your name, company, mobile number and email. To have a person follow up, choose “Send to the team” in the chat and check the summary before it is sent, or go to Request a Quote.',
    rfq: 'Request a Quote',
  },
  id: {
    title: 'VORA Agent: asisten AI untuk pertanyaan freight dan logistik | VORA',
    description: 'Tanya VORA Agent soal freight, customs, distribusi domestik, project cargo, atau pergudangan, dan siapkan detail untuk penawaran. Chat sambil menjelajah.',
    label: 'VORA / VIRTUAL AGENT',
    h1: 'Tanya VORA Agent soal pengiriman Anda.',
    intro: 'VORA Agent adalah asisten AI di website ini. Tanyakan soal freight internasional, customs, distribusi domestik, project cargo, atau pergudangan, dan agent akan membantu menyusun detail yang dibutuhkan untuk penawaran.',
    keep: 'Perkecil chat agar tetap di pojok layar saat Anda membuka halaman lain. Percakapan berlanjut dari pesan terakhir. Di HP, chat menunggu di tombol Tanya VORA.',
    fallback: 'Chat sedang dimuat. Jika tidak muncul, gunakan Minta Penawaran atau email info@voraworld.id.',
    examplesTitle: 'Contoh pertanyaan untuk memulai',
    examplesHint: 'Pilih pertanyaan untuk memasukkannya ke chat.',
    examples: [
      'Data apa saja yang dibutuhkan untuk penawaran sea freight?',
      'Apa bedanya FCL dan LCL?',
      'Dokumen apa yang biasanya dibutuhkan untuk customs clearance?',
      'Bagaimana chargeable weight air freight dihitung?',
    ],
    limitsTitle: 'Yang tidak bisa dilakukan',
    limits: [
      'VORA Agent tidak bisa melacak shipment, mengecek rate atau ketersediaan ruang secara langsung, maupun mengonfirmasi harga, booking, izin, atau transit time. Semua itu disampaikan tim VORA melalui penawaran tertulis.',
      'Jawaban AI bisa keliru. Jangan bagikan password, data rekening, atau dokumen identitas di chat.',
    ],
    teamTitle: 'Saat ingin ditindaklanjuti tim',
    team: 'Sebelum pesan pertama, agent meminta nama, perusahaan, nomor HP, dan email Anda. Agar ditindaklanjuti tim, pilih “Teruskan ke tim” di chat dan periksa ringkasannya sebelum dikirim, atau buka Minta Penawaran.',
    rfq: 'Minta Penawaran',
  },
}

/** The id of the element the page leaves for the chat; the site-wide VoraAgent widget docks itself there. */
export const AGENT_DOCK_ID = 'vora-agent-dock'
/** Event a page dispatches to put a question in the chat input (detail: { text: string }). */
export const AGENT_PREFILL_EVENT = 'vora-agent:prefill'
