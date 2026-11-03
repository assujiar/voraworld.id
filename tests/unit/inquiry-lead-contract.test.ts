import { beforeEach,describe,expect,it,vi } from 'vitest'
const m=vi.hoisted(()=>({rpc:vi.fn(),one:vi.fn(),many:vi.fn(),insert:vi.fn(),update:vi.fn(),enqueue:vi.fn(),config:vi.fn(),audit:vi.fn()}))
vi.mock('@/server/data',()=>({rpc:m.rpc,one:m.one,many:m.many,insert:m.insert,update:m.update}))
vi.mock('@/server/mail/outbox',()=>({enqueue:m.enqueue}))
vi.mock('@/server/mail/config',()=>({getMailConfig:m.config}))
vi.mock('@/server/env',()=>({publicBaseUrl:()=> 'https://audit.example.invalid'}))
vi.mock('@/server/audit',()=>({recordAudit:m.audit}))
import { createLead,INQUIRY_MAX_PER_EMAIL,INQUIRY_WINDOW_MINUTES } from '@/server/leads'
const input={kind:'contact' as const,name:'Sample',email:'qa@example.invalid',phone:'+62 812 3456 7890',message:'Shipment question',company:'Test only',mode:'',origin:'',destination:'',cargo:'',pickup:''}
beforeEach(()=>{vi.clearAllMocks();m.rpc.mockResolvedValue({id:7,reference:'TEST-ONLY'});m.config.mockResolvedValue({enabled:true,adminEmail:'ops@example.invalid'});m.enqueue.mockResolvedValue(true)})
describe('original lead creation contract',()=>{
 it('requires a visitor phone number before touching the database',async()=>{await expect(createLead({...input,phone:''})).rejects.toThrow('Phone / WhatsApp number is required');expect(m.rpc).not.toHaveBeenCalled();expect(m.enqueue).not.toHaveBeenCalled()})
 it('rejects an invalid nonempty number before touching the database',async()=>{await expect(createLead({...input,phone:'call me'})).rejects.toThrow('Enter a valid phone');expect(m.rpc).not.toHaveBeenCalled()})
 it('preserves RPC name, payload and rate limits for valid inquiries',async()=>{await createLead(input);expect(m.rpc).toHaveBeenCalledWith('lead_create',{p:{...input,window_minutes:15,max_per_email:4}});expect(INQUIRY_WINDOW_MINUTES).toBe(15);expect(INQUIRY_MAX_PER_EMAIL).toBe(4)})
 it('queues the existing two email events with stable deduplication keys',async()=>{await createLead(input);expect(m.enqueue).toHaveBeenCalledTimes(2);expect(m.enqueue).toHaveBeenNthCalledWith(1,'lead_admin','ops@example.invalid',expect.objectContaining({phone:input.phone,lead_id:'TEST-ONLY'}),{dedupeKey:'lead-admin-7'});expect(m.enqueue).toHaveBeenNthCalledWith(2,'lead_customer','qa@example.invalid',expect.any(Object),{dedupeKey:'lead-customer-7'})})
 it('keeps email disabled when SMTP configuration is off',async()=>{m.config.mockResolvedValue({enabled:false});await createLead(input);expect(m.enqueue).not.toHaveBeenCalled()})
 it('refuses incomplete RFQ route data before RPC or notification',async()=>{await expect(createLead({...input,kind:'rfq',mode:'domestic-distribution/ftl',origin:'Jakarta',destination:''})).rejects.toThrow('Service, origin and destination required');expect(m.rpc).not.toHaveBeenCalled();expect(m.enqueue).not.toHaveBeenCalled()})
 it('does not queue a receipt when the database refuses the inquiry',async()=>{m.rpc.mockRejectedValue(new Error('Too many submissions; try again later'));await expect(createLead(input)).rejects.toThrow('Too many submissions');expect(m.enqueue).not.toHaveBeenCalled()})
})
