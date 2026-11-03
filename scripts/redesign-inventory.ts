/** Rebuild the service inventory, preserving the manually curated core/admin entries. No database access. */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { serviceDesigns } from '../src/content/service-design'
import { visualAssets } from '../src/content/visual-assets'
const routes = Object.entries(serviceDesigns).map(([route,d]) => ({route:'/services/'+route,locales:['en','id'],mainAsset:visualAssets[d.asset].src,layout:d.family,secondSection:'ShipmentDossier / '+d.family,motion:d.motion,cta:{en:d.en.cta,id:d.id.cta}}))
const target='docs/ROUTE_IMPLEMENTATION_MATRIX.json'
const core: unknown[] = existsSync(target) ? JSON.parse(readFileSync(target,'utf8')).filter((entry: {route: string}) => !entry.route.startsWith('/services/')) : []
writeFileSync(target,JSON.stringify([...routes,...core],null,2)+'\n')
console.log(`${routes.length} service compositions catalogued`)
