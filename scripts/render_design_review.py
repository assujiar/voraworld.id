"""Offline Chromium layout review of SSR HTML; no network access or live deployment implied."""
from pathlib import Path
import base64, mimetypes, re, json
from urllib.parse import urlsplit, unquote
from fastapi.testclient import TestClient
from playwright.sync_api import sync_playwright
from vora.main import app

ROOT=Path(__file__).resolve().parents[1]
STATIC=ROOT/'vora'/'static'
OUT=ROOT/'previews'
OUT.mkdir(exist_ok=True)
ROUTES=[('home','/en/'),('services','/en/services'),('international','/en/services/international-freight-forwarding'),('domestic','/en/services/domestic-distribution'),('customs','/en/services/customs-brokerage'),('warehousing','/en/services/3pl-warehousing'),('project','/en/services/project-cargo'),('about','/en/about'),('contact','/en/contact'),('rfq','/en/request-quote'),('insights','/en/insights')]
WIDTHS=[390,1440]

def hydrate(markup):
    def style(m):
        path=urlsplit(m.group(1)).path
        f=STATIC/unquote(path[len('/static/'):])
        return '<style>'+f.read_text()+'</style>' if f.is_file() else m.group(0)
    markup=re.sub(r'<link rel="stylesheet" href="(/static/[^\"]+)">',style,markup)
    def image(m):
        path=urlsplit(m.group(1)).path
        f=STATIC/unquote(path[len('/static/'):])
        if not f.is_file():return m.group(0)
        mime=mimetypes.guess_type(f.name)[0] or 'application/octet-stream'
        return 'src="data:'+mime+';base64,'+base64.b64encode(f.read_bytes()).decode()+'"'
    return re.sub(r'src="(/static/[^\"]+)"',image,markup).replace('loading="lazy"','loading="eager"')

if __name__=='__main__':
    results=[]
    with TestClient(app) as c, sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
        for name,path in ROUTES:
            resp=c.get(path)
            if resp.status_code!=200:
                results.append({'page':name,'error':f'HTTP {resp.status_code}'});continue
            content=hydrate(resp.text)
            for width in WIDTHS:
                page=browser.new_page(viewport={'width':width,'height':900},device_scale_factor=1)
                errors=[]
                page.on('pageerror',lambda error:errors.append(str(error)))
                page.set_content(content,wait_until='load',timeout=20000)
                page.evaluate("document.fonts.ready")
                page.wait_for_timeout(50)
                checks=page.evaluate('''() => ({scrollWidth: document.documentElement.scrollWidth,
                  bodyWidth:document.body.scrollWidth,
                  viewport:innerWidth,
                  broken:Array.from(document.images).filter(i=>!i.complete||!i.naturalWidth).map(i=>i.alt).slice(0,8),
                  visibleServices:document.querySelectorAll('.service-tile').length,
                  heroHeight:Math.round(document.querySelector('.hero-vora, .service-detail-hero, .services-intro, .page-intro, .subhero')?.getBoundingClientRect().height||0) })''')
                results.append({'page':name,'width':width,**checks,'jsErrors':errors})
                if width in [390,1440]:
                    page.screenshot(path=str(OUT/(name+'-clay-'+('mobile' if width==390 else 'desktop')+'.png')),full_page=True)
                page.close(); print(name,width,flush=True)
        browser.close()
    (OUT/'DESIGN_REVIEW_RESULTS.json').write_text(json.dumps(results,indent=2))
    errors=[x for x in results if 'error' in x or x.get('scrollWidth',0)>x.get('viewport',0) or x.get('broken') or x.get('jsErrors')]
    print('Rendered',len(results),'review combinations; issues:',len(errors))
    for x in errors[:20]:print(x)
