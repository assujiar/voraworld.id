import { makeT, type Locale } from '@/content'
import type { SnapshotSection } from '@/server/site'

/** Sections published from the admin page editor (frozen snapshot, never the draft). */
export function CustomSections({ locale, sections }: { locale: Locale; sections?: SnapshotSection[] | null }) {
  const t = makeT(locale)
  return (
    <>
      {(sections ?? []).filter((s) => s.visible).map((s, i) => (
        <section key={i} className={`site-section section-${['ink', 'paper', 'white'].includes(s.surface) ? s.surface : 'paper'}`}>
          <div className={`wrap ${s.layout === 'split' ? 'split' : ''}`}>
            <div>
              <span className="eyebrow">VORA / {s.kind}</span>
              <h2>{s.title}</h2>
              <p>{s.body}</p>
              {s.button_href && s.button_href.startsWith('/') && !s.button_href.startsWith('//')
                ? <a className="button-outline" href={s.button_href}>{s.button_label || t('Learn more', 'Selengkapnya')} ↗</a> : null}
            </div>
            {s.image ? <div className="split-figure"><img src={s.image} alt={s.title} loading="lazy" /></div> : null}
          </div>
        </section>
      ))}
    </>
  )
}
