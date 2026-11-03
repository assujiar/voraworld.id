import { makeT } from '@/content'
import { publicSearchItems, type SearchItem } from '@/content/public-ux'
import { rankSearch } from '@/lib/public-ux'
import { pageMetadata } from '@/lib/metadata'
import { localeOf, type LocaleParams } from '@/lib/page'
import { searchArticles } from '@/server/articles'
import { many } from '@/server/data'

type Props=LocaleParams & {searchParams:Promise<{q?:string}>}
export async function generateMetadata({params}:LocaleParams){
  const locale=await localeOf(params),t=makeT(locale)
  return pageMetadata({locale,path:'/search',title:t('Search | VORA','Pencarian | VORA'),description:t('Find services, answers and shipment guidance.','Temukan layanan, jawaban, dan panduan pengiriman.'),noindex:true})
}
export default async function Search({params,searchParams}:Props){
  const locale=await localeOf(params),t=makeT(locale),sp=await searchParams
  const q=String(sp.q??'').trim().slice(0,100)
  const [articles,faqs]=q ? await Promise.all([searchArticles(locale,q,1,20),many('faqs',f=>f.eq('visible',true).order('position').order('id'),'id,question,answer')]) : [{articles:[],total:0},[]]
  let index=publicSearchItems(locale).filter(item=>item.category!=='Field note'&&item.category!=='Catatan praktis')
  if(faqs.length)index=[...index.filter(i=>i.category!=='FAQ'),...faqs.map(f=>({href:`/${locale}/faq#question-${f.id}`,title:String(f.question),body:String(f.answer),category:'FAQ'}))]
  const results:SearchItem[]=rankSearch(index,q)
  for(const article of articles.articles)if(article.slug&&article.title)results.push({href:`/${locale}/insights/${article.slug}`,title:article.title,body:article.excerpt??'',category:t('Insight','Artikel')})
  return <section className="v-section ux-search-page"><div className="v-wrap"><p className="a-label">{t('Find your way','Temukan yang Anda butuhkan')}</p><h1 className="v-h2">{t('Search VORA','Cari di VORA')}</h1><p className="a-intro">{t('Use everyday words. Try “shared truck”, “customs” or “proof of delivery”.','Pakai bahasa sehari-hari. Coba “muatan nggak penuh satu truk”, “bea cukai”, atau “bukti serah terima”.')}</p>
    <form method="get" role="search" className="ux-search-form"><label htmlFor="site-search">{t('Search services, FAQs and published articles','Cari layanan, FAQ, dan artikel yang sudah terbit')}</label><div className="ux-search-row"><input id="site-search" type="search" name="q" maxLength={100} defaultValue={q} autoComplete="off"/><button className="v-btn">{t('Search','Cari')}</button></div></form>
    {q ? <><p className="ux-search-count" role="status">{results.length ? t(`${results.length} results for “${q}”`,`${results.length} hasil untuk “${q}”`) : t(`No results for “${q}”. Try a shorter phrase or choose a service below.`,`Belum ada hasil untuk “${q}”. Coba frasa yang lebih singkat atau pilih layanan di bawah.`)}</p><ul className="ux-search-results">{results.map(r=><li key={r.href}><span className="a-label">{r.category}</span><h2><a href={r.href}>{r.title}<span aria-hidden="true"> ↗</span></a></h2><p>{r.body}</p></li>)}</ul></> : null}
    {articles.total>articles.articles.length ? <p><a className="v-link" href={`/${locale}/insights?q=${encodeURIComponent(q)}`}>{t('View all matching articles', 'Lihat semua artikel yang cocok')}</a></p> : null}
    <div className="ux-search-next"><a className="v-link" href={`/${locale}/services#service-help`}>{t('Help me choose a service','Bantu saya memilih layanan')}</a><a className="v-link" href={`/${locale}/contact`}>{t('Ask the team','Tanya tim VORA')}</a></div>
  </div></section>
}
