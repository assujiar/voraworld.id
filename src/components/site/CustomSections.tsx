import { makeT, type Locale } from '@/content'
import type { SnapshotSection } from '@/server/site'

/** Sections published from the admin page editor (frozen snapshot, never the draft). */
export function CustomSections({ locale, sections }: { locale: Locale; sections?: SnapshotSection[] | null }) {
  const t = makeT(locale)
  return (
    <>
      {(sections ?? []).filter((s) => s.visible).map((s, i) => (
        <section key={i} className={`v-section ${s.surface === 'ink' ? 'v-dark' : s.surface === 'white' ? '' : 'v-section--bone'}`}>
          <div className={`v-wrap ${s.layout === 'split' ? 'v-two' : ''}`}>
            <div>
              <h2 className="v-h2">{s.title}</h2>
              <p style={{ marginTop: 18 }}>{s.body}</p>
              {s.button_href && s.button_href.startsWith('/') && !s.button_href.startsWith('//')
                ? <a className="v-link" href={s.button_href}>{s.button_label || t('Learn more', 'Selengkapnya')}</a> : null}
            </div>
            {s.image ? <div><img src={s.image} alt={s.title} loading="lazy" style={{ borderRadius: 20 }} /></div> : null}
          </div>
        </section>
      ))}
    </>
  )
}
