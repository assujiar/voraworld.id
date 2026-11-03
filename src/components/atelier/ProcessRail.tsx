import { makeT, type Locale } from '@/content'
import type { VisualAsset } from '@/content/visual-assets'
import { ObjectArt } from './ObjectArt'

/** A schematic of planning stages; deliberately contains no live/fabricated tracking state. */
export function ProcessRail({ locale, steps, title, accent }: { locale: Locale; steps: Array<[string, string]>; title?: string; accent?: VisualAsset }) {
  const t = makeT(locale)
  return <div className="a-process">
    {title ? <p className="a-label">{title}</p> : null}
    <ol>{steps.map(([name, body], i) => <li key={name} data-assembly><span className="a-process__n" aria-hidden="true">0{i + 1}</span><h3>{name}</h3><p>{body}</p></li>)}</ol>
    <p className={`a-caption${accent ? ' a-process__caption' : ''}`}>{accent ? <ObjectArt asset={accent} sizes="52px" /> : null}{t('Planning sequence · the confirmed scope is stated in your quotation.', 'Alur perencanaan · cakupan yang disepakati tercantum dalam quotation.')}</p>
  </div>
}
