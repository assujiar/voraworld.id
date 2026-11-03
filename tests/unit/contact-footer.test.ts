import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { officeDirectionsUrl } from '@/lib/contact-links'
import { Footer } from '@/components/site/Footer'
import { InquiryPage } from '@/components/site/InquiryPage'
import { siteText } from '@/content'
const settings=vi.hoisted(()=>({email:'info@voraworld.id',address:'Gedung Nucira, Jl. Letjen M.T. Haryono Kav. 27, Tebet, Jakarta Selatan, DKI Jakarta 12810'}))
vi.mock('@/server/site',()=>({getSettings:async()=>settings}))
vi.mock('@/actions/public',()=>({submitContact:vi.fn(),submitQuote:vi.fn()}))

describe('visitor inquiry actions and contact details',()=>{
  it.each([['en','contact'],['id','contact'],['en','quote'],['id','quote']] as const)('%s %s requires a mobile number and offers email and directions actions',async(locale,kind)=>{
    const html=renderToStaticMarkup(await InquiryPage({locale,kind,sp:{}}))
    const phones=[...html.matchAll(/<input\b[^>]*\bname="phone"[^>]*>/g)]
    expect(phones).toHaveLength(1)
    expect(phones[0][0]).toContain('required=""')
    expect(phones[0][0]).toContain('type="tel"')
    expect(html).toContain(`mailto:${settings.email}`)
    expect(html).toContain(locale==='en'?'Send email':'Kirim email')
    expect(html).toContain(locale==='en'?'Get directions':'Lihat rute')
    expect(html.match(/role="tooltip"/g)).toHaveLength(2)
    expect(html.match(/class="ux-contact-action"/g)).toHaveLength(2)
    expect(html).toContain(locale==='en'?'aria-label="Send an email to VORA"':'aria-label="Kirim email ke VORA"')
    const match=html.match(/href="(https:\/\/www.google.com\/maps\/dir\/[^\"]+)"/)
    expect(match).not.toBeNull()
    const url=new URL(match![1].replaceAll('&amp;','&'))
    expect(url.searchParams.get('destination')).toBe(settings.address)
    expect(url.searchParams.get('api')).toBe('1')
    expect(url.searchParams.has('origin')).toBe(false)
    expect(html).not.toContain('Copy email address')
    expect(html).not.toContain('Copy office address')
  })
  it('encodes the configured office address without letting its characters become URL parameters',()=>{
    const address='Office & reception #2, Jakarta?origin=unexpected'
    const url=new URL(officeDirectionsUrl(address))
    expect(url.origin).toBe('https://www.google.com')
    expect(url.pathname).toBe('/maps/dir/')
    expect(url.searchParams.get('destination')).toBe(address)
    expect([...url.searchParams.keys()].sort()).toEqual(['api','destination'])
  })
})

describe('footer identity',()=>{
  it.each(['en','id'] as const)('%s keeps one readable tagline with the official animated logo and no decorative signal',locale=>{
    const html=renderToStaticMarkup(createElement(Footer,{locale,settings}))
    expect(html).toContain(siteText.en.home_title)
    expect(html).not.toContain('Membawa Dunia Lebih Dekat.')
    expect(html).toContain('© 2023 VORA')
    expect(html.match(/data-footer-tagline-motion=/g)).toHaveLength(1)
    expect(html).toContain('data-brand-study="01"')
    expect(html).not.toContain('v-footer__signal')
    expect(html).not.toContain('<canvas')
  })
})
