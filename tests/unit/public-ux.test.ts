import { describe, expect, it } from 'vitest'
import { serviceGroups, serviceModes } from '@/content'
import { comparisonOptions, publicSearchItems } from '@/content/public-ux'
import { clipText, fieldError, rankSearch, safeDraft, suggestedServices } from '@/lib/public-ux'
import { inquiryError } from '@/lib/inquiry-copy'
import { documentSamples, sampleNotice } from '@/content/document-samples'
import { readFileSync } from 'node:fs'
import { PDFDocument } from 'pdf-lib'

const exists=(key:string)=>{const [group,mode]=key.split('/');return Boolean(serviceGroups[group] && (!mode||serviceModes[group]?.[mode]))}
describe('public service guidance',()=>{
  it('maps everyday Indonesian and English to the relevant service, without guessing prices',()=>{
    expect(rankSearch(publicSearchItems('id'),'muatan nggak penuh satu truk')[0].href).toBe('/id/services/domestic-distribution/ltl')
    expect(rankSearch(publicSearchItems('en'),'I need a shared container')[0].href).toBe('/en/services/domestic-distribution/lcl')
    expect(rankSearch(publicSearchItems('id'),'mau urus bea cukai')[0].href).toBe('/id/services/customs-brokerage')
    expect(rankSearch(publicSearchItems('en'),'zzqxv imaginary thing')).toEqual([])
    expect(rankSearch(publicSearchItems('en'),'   ')).toEqual([])
  })
  it('keeps ambiguous needs broad and routes explicit choices to real modes',()=>{
    expect(suggestedServices('domestic')).toEqual(['domestic-distribution'])
    expect(suggestedServices('domestic','road','shared')).toEqual(['domestic-distribution/ltl'])
    expect(suggestedServices('domestic','sea','dedicated')).toEqual(['domestic-distribution/fcl'])
    expect(suggestedServices('domestic','road')).toHaveLength(2)
    for(const need of ['domestic','international','customs','warehouse','project'] as const)for(const mode of ['road','sea','air','unsure'] as const) expect(suggestedServices(need,mode).every(exists)).toBe(true)
  })
  it('compares every published group and mode with nonempty native-language requirements',()=>{
    const all=Object.entries(serviceGroups).flatMap(([g,s])=>[g,...s.modes.map(m=>`${g}/${m}`)])
    expect(new Set(comparisonOptions.map(c=>c.key))).toEqual(new Set(all))
    for(const c of comparisonOptions)for(const locale of ['en','id'] as const)for(const field of ['title','fit','handling','tradeoff','prepare'] as const)expect(c[field][locale].length).toBeGreaterThan(8)
  })
})
describe('form continuity and validation',()=>{
  it('keeps public refusals native and hides internal errors',()=>{
    expect(inquiryError('id','Consent required')).toContain('Centang')
    expect(inquiryError('en','Too many submissions; try again later')).toContain('try again later')
    expect(inquiryError('id','private database connection detail')).not.toContain('database')
    expect(inquiryError('id','Phone / WhatsApp number is required')).toContain('nomor HP')
    expect(inquiryError('en')).toBeUndefined()
  })
  it('retains only editable inquiry fields and rejects hidden/action/consent data',()=>{
    expect(safeDraft({name:'Sam',email:'sam@example.test',cargo:'Cartons',phone:'+62 812 3456 7890',consent:'yes',locale:'en',website:'bot',_back:'evil','$ACTION_ID':'x',password:'secret'})).toEqual({name:'Sam',email:'sam@example.test',cargo:'Cartons',phone:'+62 812 3456 7890'})
    expect(safeDraft(null)).toEqual({});expect(safeDraft('bad')).toEqual({})
    expect(safeDraft({cargo:'x'.repeat(9000)}).cargo).toHaveLength(6000)
  })
  it('requires and validates mobile numbers in both languages',()=>{
    for(const locale of ['en','id'] as const){
      for(const value of ['', '  ', 'call me', '123456', '+1234567890123456'])expect(fieldError('phone',value,true,locale)).not.toBe('')
      for(const value of ['081234567890','+62 812 3456 7890','+62 (812) 3456-7890'])expect(fieldError('phone',value,true,locale)).toBe('')
    }
    expect(safeDraft({phone:'1'.repeat(80)}).phone).toHaveLength(40)
  })
  it('treats whitespace and invalid email as incomplete in both languages',()=>{
    for(const locale of ['en','id'] as const){
      expect(fieldError('name','  ',true,locale)).not.toBe('')
      expect(fieldError('email','a@b',true,locale)).not.toBe('')
      expect(fieldError('email','a@b.test',true,locale)).toBe('')
      expect(fieldError('company','',false,locale)).toBe('')
      expect(fieldError('consent','yes',true,locale,false)).not.toBe('')
      expect(fieldError('consent','yes',true,locale,true)).toBe('')
    }
  })
})
describe('safe public document examples',()=>{
  it('ships six readable one-page samples without interactive fields or verification links',async()=>{
    for(const sample of documentSamples)for(const locale of ['en','id'] as const){
      expect(sampleNotice[locale]).toContain(locale==='en'?'SAMPLE':'CONTOH')
      const bytes=readFileSync(`public/samples/${sample.key}-${locale}.pdf`),pdf=await PDFDocument.load(bytes)
      expect(pdf.getPageCount()).toBe(1);expect(pdf.getForm().getFields()).toHaveLength(0)
      expect(pdf.getTitle()).toContain(locale==='en'?'SAMPLE':'CONTOH')
      expect(pdf.getPages()[0].node.Annots()?.size()??0).toBe(0)
    }
  })
})

describe('card excerpts',()=>{
  it('cuts at a whole word and marks the cut, never in the middle of a word',()=>{
    const text='A shipment is finished when its records agree: what was quoted, what was delivered and what was paid. Reconciling them in order, and keeping the exceptions visible, prevents disputes.'
    const out=clipText(text,170)
    expect(out.endsWith('…')).toBe(true)
    expect(out.length).toBeLessThanOrEqual(171)
    expect(text.startsWith(out.slice(0,-1))).toBe(true)
    expect(text[out.length-1]).toMatch(/[\s,.;:]/)
    expect(clipText('Hello, world, and more',13)).toBe('Hello, world…')
    expect(clipText('One sentence ends. Then another one follows',19)).toBe('One sentence ends…')
  })
  it('leaves short text whole and tidies its spacing',()=>{
    expect(clipText('  Short   excerpt. ',170)).toBe('Short excerpt.')
  })
})
