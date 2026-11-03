import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { serviceGroups, serviceModes } from '@/content'
import { serviceDesigns } from '@/content/service-design'
import { shipmentDossiers } from '@/content/shipment-dossiers'
import { visualAssets } from '@/content/visual-assets'
import { ServiceHero } from '@/components/atelier/ServiceHero'
import { ShipmentDossier } from '@/components/atelier/ShipmentDossier'

describe('bilingual service release contract', () => {
 const routes=Object.entries(serviceGroups).flatMap(([group,g])=>[[group,undefined],...g.modes.map(mode=>[group,mode])] as Array<[string,string|undefined]>)
 it('covers every real service and localizes its operational brief',()=>{
  for(const [group,mode] of routes){const key=mode?`${group}/${mode}`:group;expect(serviceDesigns[key]).toBeDefined();for(const locale of ['en','id'] as const){const d=shipmentDossiers[key][locale];expect(d.body.length).toBeGreaterThan(120);expect(d.steps).toHaveLength(3);expect(d.prepare.length).toBeGreaterThan(70);const h=renderToStaticMarkup(<><ServiceHero locale={locale} group={group} mode={mode}/><ShipmentDossier locale={locale} group={group} mode={mode}/></>);expect((h.match(/<h1>/g)||[]).length).toBe(1);expect(h).toContain(`/${locale}/request-quote?mode=${group}`);expect(h).toContain(d.title.replaceAll('&','&amp;'));expect(h).not.toContain('vora-scene-')}}
 })
 it('ships every selected independent object and the canonical brand masters',()=>{
  for(const asset of Object.values(visualAssets)){expect(existsSync('public'+asset.src)).toBe(true);expect(asset.width).toBeGreaterThan(150);expect(asset.height).toBeGreaterThan(100)}
  for(const name of ['vora-primary','vora-reverse','vora-a-icon-primary','vora-a-icon-reverse'])expect(readFileSync(`public/static/assets/${name}.svg`,'utf8')).toContain('<svg')
 })
 it('has a distinct EN and ID brief and a valid mode catalogue',()=>{
  for(const [key,value] of Object.entries(shipmentDossiers))expect(value.en.body,key).not.toBe(value.id.body)
  for(const [group,g] of Object.entries(serviceGroups))for(const mode of g.modes)expect(serviceModes[group][mode]).toBeDefined()
 })
})
