import { beforeEach, describe, expect, it, vi } from 'vitest'
const createLead=vi.hoisted(()=>vi.fn(async()=>({id:1,reference:'test-inquiry'})))
vi.mock('@/server/leads',()=>({createLead}))
vi.mock('@/server/after',()=>({afterResponse:vi.fn()}))
vi.mock('@/server/mail/outbox',()=>({dispatch:vi.fn()}))
vi.mock('@/server/action',()=>({ActionError:class extends Error{}, publicRun:async(form:FormData,_fallback:string,work:(v:{form:FormData})=>unknown)=>work({form})}))
import { submitContact, submitQuote } from '@/actions/public'
beforeEach(()=>createLead.mockClear())
describe('approved inquiry contact policy',()=>{
 const form=()=>{const f=new FormData();f.set('name','Test');f.set('email','test@example.invalid');f.set('phone','+62 812 3456 7890');f.set('message','Shipment scope');f.set('consent','yes');f.set('locale','id');return f}
 it('preserves the visitor mobile number for a contact inquiry',async()=>{const f=form();await submitContact(f);expect(createLead).toHaveBeenCalledWith(expect.objectContaining({email:'test@example.invalid',phone:'+62 812 3456 7890'}))})
 it('retains RFQ shipment context and the visitor mobile number',async()=>{const f=form();f.set('mode','domestic-distribution/ftl');f.set('origin','Jakarta');f.set('destination','Bandung');await submitQuote(f);expect(createLead).toHaveBeenCalledWith(expect.objectContaining({mode:'domestic-distribution/ftl',origin:'Jakarta',destination:'Bandung',phone:'+62 812 3456 7890'}))})
 it('does not create a lead without consent',async()=>{const f=form();f.delete('consent');await expect(submitContact(f)).rejects.toThrow('Consent required');expect(createLead).not.toHaveBeenCalled()})
 it('keeps the honeypot from creating records',async()=>{const f=form();f.set('website','bot');await submitContact(f);expect(createLead).not.toHaveBeenCalled()})
})
