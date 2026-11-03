import { IllustrationFigure } from '@/components/atelier/IllustrationFigure'
import { ObjectArt } from '@/components/atelier/ObjectArt'
import { pageDescriptions } from '@/content/page-seo'
import { CustomSections } from '@/components/site/CustomSections'
import { InsightCards } from '@/components/site/InsightCards'
import { makeT, seoTitles, seoDescription, siteText } from '@/content'
import { workingNotes } from '@/content/working-notes'
import { ARCHIVE_YEARS, archiveNote, parseArchiveTags } from '@/lib/archive'
import { localeOf, type LocaleParams } from '@/lib/page'
import { pageMetadata } from '@/lib/metadata'
import { articleTopics, searchArticles } from '@/server/articles'
import { getPublishedPage } from '@/server/site'

type P = LocaleParams & { searchParams: Promise<{ q?: string; page?: string; topic?: string; year?: string; quarter?: string }> }

export async function generateMetadata({ params }: LocaleParams) {
  const locale = await localeOf(params)
  return pageMetadata({ locale, path: '/insights', title: seoTitles[locale].insights, description: pageDescriptions[locale].insights })
}

const int = (v: string | undefined, min: number, max: number) => { const n = Number.parseInt(v ?? '', 10); return Number.isFinite(n) && n >= min && n <= max ? n : null }

export default async function Insights({ params, searchParams }: P) {
  const locale = await localeOf(params)
  const t = makeT(locale)
  const sp = await searchParams
  const q = String(sp.q ?? '').trim().slice(0, 100)
  const topic = String(sp.topic ?? '').trim().slice(0, 80)
  const year = int(sp.year, 2023, 2026)
  const quarter = year ? int(sp.quarter, 1, 4) : null
  const page = Math.max(1, Math.min(500, Number.parseInt(sp.page ?? '1', 10) || 1))
  const [{ articles, totalPages, total }, topics, custom] = await Promise.all([searchArticles(locale, q, page, 12, { topic, year, quarter }), articleTopics(locale), getPublishedPage('insights', locale)])
  const filtered = Boolean(q || topic || year)
  const hasArchive = articles.some((a) => parseArchiveTags(a.tags).year)
  const keep = (n: number) => { const u = new URLSearchParams(); if (q) u.set('q', q); if (topic) u.set('topic', topic); if (year) u.set('year', String(year)); if (quarter) u.set('quarter', String(quarter)); u.set('page', String(n)); return `?${u}` }
  return (
    <div className="hybrid-preserved hybrid-insights">
      <section className="a-cover a-cover--insights">
        <div className="v-wrap">
          <p className="a-label">INSIGHTS / FIELD NOTES</p><h1>{t('The details worth knowing before you ship.', 'Detail yang perlu dipahami sebelum mengirim.')}</h1>
          <p className="a-intro">{t('Reference notes on quotations, documents, handover and cargo preparation, written for people who arrange shipments.', 'Catatan rujukan tentang penawaran, dokumen, serah terima, dan persiapan kargo, ditulis untuk orang yang mengatur pengiriman.')}</p>
          <div className="x-journal-note"><div><span className="a-label">FIELD REFERENCE / 01</span><h2>{t('Before the booking. Before the handover.','Sebelum booking. Sebelum serah terima.')}</h2><p>{t('Packing, documentation and scope decisions that are worth resolving before cargo moves.','Keputusan tentang kemasan, dokumen, dan cakupan yang perlu diselesaikan sebelum barang bergerak.')}</p><a className="v-link" href={`/${locale}/faq`}>{t('Read the practical questions','Baca pertanyaan praktis')} →</a></div><ObjectArt asset="schedule" priority/></div>
          <aside className="a-note-signals" aria-label={t('Quotation and timing inputs', 'Dasar penawaran dan jadwal')}>
            <div className="a-note-comparison"><IllustrationFigure asset="n09-quotation-comparison" locale={locale} sizes="(max-width: 600px) 86vw, 280px" caption={t('Example quotations for comparing scope.', 'Contoh penawaran untuk membandingkan cakupan.')} /><div><h3>{t('Compare the same scope.', 'Bandingkan cakupan yang sama.')}</h3><p>{t('Check handling, local charges and exclusions alongside the freight rate.', 'Periksa handling, biaya lokal, dan pengecualian bersama tarif angkutnya.')}</p></div></div>
            <div><ObjectArt asset="stopwatch" sizes="96px" /><div><h3>{t('Work back from the cut-off.', 'Susun jadwal mundur dari cut-off.')}</h3><p>{t('Allow time for packing, documents and the receiving window.', 'Sisihkan waktu untuk kemasan, dokumen, dan jadwal penerimaan.')}</p></div></div>
          </aside>
          {total > 0 || filtered ? (
            <form method="get" className="v-archivefilter" role="search" aria-label={t('Search and filter articles', 'Cari dan saring artikel')}>
              <div className="v-field"><label htmlFor="ar-q">{t('Search', 'Cari')}</label><input id="ar-q" name="q" type="search" defaultValue={q} autoComplete="off" /></div>
              {topics.length ? (
                <div className="v-field"><label htmlFor="ar-topic">{t('Topic', 'Topik')}</label>
                  <select id="ar-topic" name="topic" defaultValue={topic}><option value="">{t('All topics', 'Semua topik')}</option>{topics.map((x) => <option key={x} value={x}>{x}</option>)}</select></div>
              ) : null}
              <div className="v-field"><label htmlFor="ar-year">{t('Archive year', 'Tahun arsip')}</label>
                <select id="ar-year" name="year" defaultValue={year ?? ''}><option value="">{t('All years', 'Semua tahun')}</option>{ARCHIVE_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}</select></div>
              <div className="v-field"><label htmlFor="ar-quarter">{t('Quarter', 'Kuartal')}</label>
                <select id="ar-quarter" name="quarter" defaultValue={quarter ?? ''}><option value="">{t('Any', 'Semua')}</option>{[1, 2, 3, 4].map((n) => <option key={n} value={n}>Q{n}</option>)}</select></div>
              <button className="v-btn">{t('Apply', 'Terapkan')}</button>
              {filtered ? <a className="v-link" href={`/${locale}/insights`}>{t('Clear filters', 'Hapus filter')}</a> : null}
            </form>
          ) : null}
        </div>
      </section>
      {total > 0 ? (
        <section className="v-section v-section--tight"><div className="v-wrap">
          {hasArchive ? <aside className="v-archivenote"><strong>{archiveNote[locale].title}</strong><p>{archiveNote[locale].body}</p></aside> : null}
          <p className="v-muted v-resultcount" role="status">{total} {t(total === 1 ? 'article' : 'articles', 'artikel')}</p>
          <InsightCards locale={locale} articles={articles} />
          {totalPages > 1 ? <nav className="v-pages" aria-label={t('Pages', 'Halaman')}>{Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => <a key={n} aria-current={n === page ? 'page' : undefined} href={keep(n)}>{n}</a>)}</nav> : null}
        </div></section>
      ) : filtered ? (
        <section className="v-section v-section--tight"><div className="v-wrap">
          <p className="v-note" role="status">{t('No article matches these filters.', 'Tidak ada artikel yang cocok dengan filter ini.')} <a className="v-link" href={`/${locale}/insights`}>{t('Clear filters', 'Hapus filter')}</a></p>
        </div></section>
      ) : (
        <section className="v-section v-section--tight" aria-labelledby="notes-h"><div className="v-wrap">
          <h2 className="v-h2--section" id="notes-h">{t('Three checklists to start with', 'Tiga daftar periksa untuk memulai')}</h2>
          <p className="v-muted v-notes__lead">{t('Longer articles are in preparation. These notes cover the questions that come up most often when a shipment is arranged.', 'Artikel yang lebih panjang sedang disiapkan. Catatan ini menjawab pertanyaan yang paling sering muncul saat pengiriman diatur.')}</p>
          <div className="v-notes">
            {workingNotes.map((n) => (
              <section key={n.id} className="v-notes__item" id={`note-${n.id}`}><h3 className="v-h3">{n.title[locale]}</h3><ul className="v-checks">{n.items[locale].map((i) => <li key={i}>{i}</li>)}</ul></section>
            ))}
          </div>
          <p className="v-notes__more"><a className="v-link" href={`/${locale}/faq`}>{t('Read the frequently asked questions', 'Baca pertanyaan yang sering diajukan')}</a></p>
        </div></section>
      )}
      <CustomSections locale={locale} sections={custom?.sections} />
      <section className="v-section v-section--tight"><div className="v-wrap v-articlecta">
        <p>{t('Planning a shipment? Send the route and the cargo and we will confirm the arrangement for that inquiry.', 'Merencanakan pengiriman? Kirim rute dan barangnya, kami akan mengonfirmasi pilihan layanannya.')}</p>
        <a className="v-btn a-inline-art" href={`/${locale}/request-quote`}><ObjectArt asset="next-step" sizes="32px" />{t('Request a quote', 'Minta penawaran')}</a>
      </div></section>
    </div>
  )
}
