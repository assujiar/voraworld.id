import { beforeEach,describe,expect,it,vi } from 'vitest'
const m=vi.hoisted(()=>({createLead:vi.fn(),after:vi.fn(),dispatch:vi.fn()}))
vi.mock('@/server/leads',()=>({createLead:m.createLead}))
vi.mock('@/server/action',async()=>{const {ActionError}=await import('@/server/errors');return {ActionError,publicRun:async(form:FormData,_back:string,run:(x:{form:FormData})=>unknown)=>run({form})}})
vi.mock('@/server/after',()=>({afterResponse:m.after}))
vi.mock('@/server/mail/outbox',()=>({dispatch:m.dispatch}))
vi.mock('@/server/env',()=>({publicBaseUrl:()=> 'https://audit.example.invalid'}))
import { submitContact,submitQuote } from '@/actions/public'
const data=(extra:Record<string,string>={})=>{const f=new FormData();for(const [k,v] of Object.entries({locale:'en',name:'Sample',email:'QA@EXAMPLE.INVALID',phone:'+62 812 3456 7890',message:'Shipment question',company:'Test only',consent:'yes',...extra}))f.set(k,v);return f}
beforeEach(()=>vi.clearAllMocks())
describe('original public action contract',()=>{
 it('keeps the submitted visitor phone number in the lead payload',async()=>{await submitContact(data());expect(m.createLead).toHaveBeenCalledWith(expect.objectContaining({phone:'+62 812 3456 7890'}))})
 it('keeps RFQ fields and email normalization',async()=>{await submitQuote(data({mode:'domestic-distribution/ftl',origin:'Jakarta',destination:'Bandung',cargo:'2 crates',pickup:'2026-11-10'}));expect(m.createLead).toHaveBeenCalledWith(expect.objectContaining({kind:'rfq',email:'qa@example.invalid',phone:'+62 812 3456 7890',mode:'domestic-distribution/ftl',origin:'Jakarta',destination:'Bandung',cargo:'2 crates',pickup:'2026-11-10'}))})
 it('requires privacy consent before creating a lead',async()=>{await expect(submitContact(data({consent:''}))).rejects.toThrow('Consent required');expect(m.createLead).not.toHaveBeenCalled();expect(m.after).not.toHaveBeenCalled()})
 it('drops honeypot submissions before storing or scheduling mail',async()=>{await submitContact(data({website:'bot.example.invalid'}));expect(m.createLead).not.toHaveBeenCalled();expect(m.after).not.toHaveBeenCalled()})
 it('schedules one existing dispatch after a valid inquiry',async()=>{await submitContact(data());expect(m.after).toHaveBeenCalledTimes(1);expect(m.dispatch).not.toHaveBeenCalled()})
})
