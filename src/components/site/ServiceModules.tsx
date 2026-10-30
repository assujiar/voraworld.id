import { customsNote, customsStages, domesticFit, forwardingLedger, projectInputs, warehouseIo } from '@/content/service-guides'
import { makeT, type Locale } from '@/content'

/** The air/ocean by import/export decision, as a ledger. On a phone each row becomes a stack whose cells carry their column heading (data-label). */
export function ForwardingLedger({ locale }: { locale: Locale }) {
  const l = forwardingLedger[locale]
  const t = makeT(locale)
  return (
    <table className="v-ledger-table">
      <caption className="sr-only">{t('Four movements compared on the decisions that differ between them', 'Empat jenis pengiriman dibandingkan pada keputusan yang berbeda di antaranya')}</caption>
      <thead><tr><th scope="col">{t('Decision', 'Keputusan')}</th>{l.columns.map((c) => <th scope="col" key={c}>{c}</th>)}</tr></thead>
      <tbody>{l.rows.map((r) => (
        <tr key={r.question}><th scope="row">{r.question}</th>{r.cells.map((c, i) => <td key={i} data-label={l.columns[i]}>{c}</td>)}</tr>
      ))}</tbody>
    </table>
  )
}

/** Customs: three stages and a synthetic example of what is compared. The example is labelled as such and holds no real name, number or amount. */
export function CustomsSpread({ locale }: { locale: Locale }) {
  const t = makeT(locale)
  const stages = customsStages[locale]
  return (
    <div className="v-docspread">
      <ol className="v-stages">
        {stages.map(([title, lead, items], i) => (
          <li key={title}>
            <span className="v-stages__n" aria-hidden="true">{i + 1}</span>
            <h3 className="v-h3">{title}</h3>
            <p className="v-muted">{lead}</p>
            <ul>{items.map((x) => <li key={x}>{x}</li>)}</ul>
          </li>
        ))}
      </ol>
      <figure className="v-papers" aria-label={t('Synthetic example of two documents compared', 'Contoh sintetis dua dokumen yang dibandingkan')}>
        <div className="v-papers__sheet v-papers__sheet--back" aria-hidden="true"><b>PACKING LIST</b><i /><i /><i /><span>Cartons: 24</span><span>Gross: 312 kg</span></div>
        <div className="v-papers__sheet" aria-hidden="true"><b>COMMERCIAL INVOICE</b><i /><i /><i /><span>Cartons: 24</span><span className="is-flag">Gross: 321 kg</span></div>
        <figcaption>{t('Example, synthetic. The weight differs between the two documents: this is what the check finds, and the source is corrected before anything is filed.', 'Contoh, sintetis. Berat berbeda di antara dua dokumen: inilah yang ditemukan pemeriksaan, dan sumbernya dikoreksi sebelum apa pun diajukan.')}</figcaption>
      </figure>
      <p className="v-note">{customsNote[locale]}</p>
    </div>
  )
}

/** Warehousing: a conceptual cross-section of the flow and the input/output structure. */
export function WarehouseSpread({ locale }: { locale: Locale }) {
  const t = makeT(locale)
  const io = warehouseIo[locale]
  const labels = locale === 'en' ? ['Receive', 'Store', 'Pick and pack', 'Dispatch'] : ['Terima', 'Simpan', 'Ambil dan kemas', 'Kirim']
  return (
    <div className="v-whouse">
      <figure className="v-whouse__fig">
        <svg viewBox="0 0 960 300" role="img" aria-label={t('Cross-section of a warehouse flow from receiving dock, through racking and a packing bench, to the dispatch dock', 'Penampang alur gudang dari dock penerimaan, rak penyimpanan, dan meja pengemasan, sampai dock pengiriman')}>
          <rect x="1" y="1" width="958" height="298" rx="6" fill="none" stroke="currentColor" strokeOpacity=".25" />
          <line x1="20" y1="250" x2="940" y2="250" stroke="currentColor" strokeOpacity=".5" strokeWidth="2" />
          {/* receiving dock and truck */}
          <rect x="30" y="170" width="150" height="80" fill="none" stroke="currentColor" strokeWidth="2" />
          <rect x="48" y="196" width="48" height="54" fill="currentColor" fillOpacity=".12" stroke="currentColor" />
          <rect x="104" y="196" width="48" height="54" fill="currentColor" fillOpacity=".12" stroke="currentColor" />
          {/* racking */}
          {[250, 330, 410].map((x) => (<g key={x}><rect x={x} y="90" width="64" height="160" fill="none" stroke="currentColor" strokeWidth="2" />{[130, 170, 210].map((y) => <line key={y} x1={x} y1={y} x2={x + 64} y2={y} stroke="currentColor" strokeOpacity=".5" />)}<rect x={x + 8} y="106" width="22" height="20" fill="currentColor" fillOpacity=".15" /><rect x={x + 34} y="146" width="22" height="20" fill="currentColor" fillOpacity=".15" /><rect x={x + 10} y="186" width="26" height="20" fill="currentColor" fillOpacity=".15" /></g>))}
          {/* packing bench */}
          <rect x="560" y="200" width="150" height="14" fill="none" stroke="currentColor" strokeWidth="2" />
          <line x1="575" y1="214" x2="575" y2="250" stroke="currentColor" strokeWidth="2" /><line x1="695" y1="214" x2="695" y2="250" stroke="currentColor" strokeWidth="2" />
          <rect x="600" y="176" width="36" height="24" fill="currentColor" fillOpacity=".15" stroke="currentColor" />
          {/* dispatch dock */}
          <rect x="770" y="170" width="150" height="80" fill="none" stroke="currentColor" strokeWidth="2" />
          <rect x="790" y="196" width="48" height="54" fill="currentColor" fillOpacity=".12" stroke="currentColor" />
          <rect x="848" y="196" width="48" height="54" fill="currentColor" fillOpacity=".12" stroke="currentColor" />
          {/* the one route gesture */}
          <path d="M105 150 C 200 60, 330 60, 440 70 S 640 90, 660 160 S 800 120, 845 150" fill="none" stroke="#b43e31" strokeWidth="3" strokeDasharray="2 8" strokeLinecap="round" />
          {[105, 330, 635, 845].map((x, i) => <g key={x}><circle cx={x} cy={i === 0 ? 150 : i === 1 ? 70 : i === 2 ? 168 : 150} r="9" fill="#b43e31" /><text x={x} y="285" textAnchor="middle" fontSize="15" fill="currentColor" fontFamily="Archivo Variable, system-ui, sans-serif">{labels[i]}</text></g>)}
        </svg>
        <figcaption>{io.caption}</figcaption>
      </figure>
      <div className="v-io">
        <div><h3 className="v-h3">{t('What we ask for', 'Yang kami minta')}</h3><dl>{io.inputs.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></div>
        <div><h3 className="v-h3">{t('What comes back', 'Yang Anda terima')}</h3><dl>{io.outputs.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></div>
      </div>
    </div>
  )
}

/** Domestic: five questions that choose the mode. */
export function DomesticFit({ locale }: { locale: Locale }) {
  return <ol className="v-fit">{domesticFit[locale].map(([q, a]) => <li key={q}><strong>{q}</strong><span>{a}</span></li>)}</ol>
}

/** Project cargo: a drawing-style fragment (no dimensions are printed: it shows what a brief must carry) beside the technical-input rail. */
export function ProjectStudy({ locale }: { locale: Locale }) {
  const t = makeT(locale)
  const p = projectInputs[locale]
  return (
    <div className="v-study">
      <figure className="v-study__fig">
        <svg viewBox="0 0 520 300" role="img" aria-label={t('Schematic of a heavy piece on a trailer with its centre of gravity and lifting points marked', 'Skema unit berat di atas trailer dengan titik berat dan titik angkat yang ditandai')}>
          <g fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="60" y="120" width="320" height="80" rx="40" />
            <line x1="40" y1="215" x2="470" y2="215" /><line x1="70" y1="215" x2="70" y2="245" /><circle cx="110" cy="248" r="16" /><circle cx="150" cy="248" r="16" /><circle cx="400" cy="248" r="16" /><circle cx="440" cy="248" r="16" />
          </g>
          <g stroke="currentColor" strokeOpacity=".45" strokeDasharray="5 5" fill="none"><line x1="60" y1="100" x2="60" y2="60" /><line x1="380" y1="100" x2="380" y2="60" /><line x1="60" y1="70" x2="380" y2="70" /></g>
          <g fill="#b43e31"><circle cx="150" cy="120" r="7" /><circle cx="290" cy="120" r="7" /></g>
          <g stroke="#b43e31" strokeWidth="2" fill="none"><circle cx="220" cy="160" r="12" /><line x1="220" y1="144" x2="220" y2="176" /><line x1="204" y1="160" x2="236" y2="160" /></g>
          <text x="150" y="108" fontSize="13" textAnchor="middle" fill="currentColor" fontFamily="Archivo Variable, system-ui, sans-serif">{t('lifting point', 'titik angkat')}</text>
          <text x="290" y="108" fontSize="13" textAnchor="middle" fill="currentColor" fontFamily="Archivo Variable, system-ui, sans-serif">{t('lifting point', 'titik angkat')}</text>
          <text x="220" y="196" fontSize="13" textAnchor="middle" fill="#b43e31" fontFamily="Archivo Variable, system-ui, sans-serif">{t('centre of gravity', 'titik berat')}</text>
          <text x="220" y="54" fontSize="13" textAnchor="middle" fill="currentColor" fontFamily="Archivo Variable, system-ui, sans-serif">{t('overall length: from the drawing', 'panjang keseluruhan: dari gambar teknis')}</text>
        </svg>
        <figcaption>{t('Schematic, not to scale. It shows what the drawing has to state; no dimension is implied.', 'Skema, tidak berskala. Menunjukkan apa yang harus tertulis di gambar teknis; tidak ada dimensi yang tersirat.')}</figcaption>
      </figure>
      <div className="v-study__rail">
        <h3 className="v-h3">{p.title}</h3>
        <dl>{p.items.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
        <p className="v-note">{p.caution}</p>
      </div>
    </div>
  )
}
