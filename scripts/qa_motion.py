"""Offline Chromium functional QA: live JS & CSS injected from local SSR output.
It does NOT verify HTTP serving, staging deployment, or Lighthouse performance.
"""
import os, sys, json, re, base64, mimetypes
from urllib.parse import urlsplit, unquote
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'previews'; OUT.mkdir(exist_ok=True)
os.environ.setdefault('APP_ENV', 'development')
os.environ.setdefault('PUBLIC_BASE_URL', 'http://testserver')
from fastapi.testclient import TestClient
sys.path.insert(0,str(ROOT))
from vora.main import app
STATIC=ROOT/'vora'/'static'
def hydrate(markup):
 def style(match):
  path=urlsplit(match.group(1)).path
  f=STATIC/unquote(path[len('/static/'):])
  return '<style>'+f.read_text()+'</style>' if f.is_file() else match.group(0)
 markup=re.sub(r'<link rel="stylesheet" href="(/static/[^"]+)">',style,markup)
 def image(match):
  path=urlsplit(match.group(1)).path
  f=STATIC/unquote(path[len('/static/'):])
  if not f.is_file():return match.group(0)
  mime=mimetypes.guess_type(f.name)[0] or 'application/octet-stream'
  return 'src="data:'+mime+';base64,'+base64.b64encode(f.read_bytes()).decode()+'"'
 markup=re.sub(r'src="(/static/[^"]+)"',image,markup)
 def script(match):
  path=urlsplit(match.group(1)).path
  f=STATIC/unquote(path[len('/static/'):])
  return '<script>'+f.read_text()+'</script>' if f.is_file() else match.group(0)
 markup=re.sub(r'<script defer src="(/static/[^"]+)"></script>',script,markup)
 return markup.replace('loading="lazy"','loading="eager"')
with TestClient(app) as client:
 results={'checks':[],'routes':[],'screenshots':[],'video':None}
 def check(name,condition,detail=None):
  results['checks'].append({'check':name,'status':'PASS' if condition else 'FAIL','detail':detail})
  print('PASS' if condition else 'FAIL',name,detail or '',flush=True)
 errors=[]
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
  for width in [360,390,768,1024,1440,1920]:
   ctx=browser.new_context(viewport={'width':width,'height':860},device_scale_factor=1)
   page=ctx.new_page();page.on('pageerror',lambda exc:errors.append(str(exc)))
   for route in ['/en/','/en/services','/en/services/international-freight-forwarding/air-import','/en/services/domestic-distribution/ftl','/en/contact','/en/request-quote']:
    res=client.get(route)
    if res.status_code==200:page.set_content(hydrate(res.text),wait_until='load',timeout=20000)
    page.wait_for_timeout(80)
    measures=page.evaluate('''() => ({scroll:document.documentElement.scrollWidth,viewport:innerWidth,images:Array.from(document.images).filter(i=>i.complete&&!i.naturalWidth).length,js:document.documentElement.dataset.voraExperience === "ready"})''')
    okay=res.status_code==200 and measures['scroll']<=width+2 and measures['images']==0 and measures['js']
    results['routes'].append({'route':route,'width':width,'status':'PASS' if okay else 'FAIL',**measures})
    if route=='/en/' and width in (390,1440):
     page.wait_for_timeout(550)
     filename='home-motion-'+('mobile' if width==390 else 'desktop')+'.png'
     page.screenshot(path=str(OUT/filename),full_page=True,animations='disabled')
     results['screenshots'].append(filename)
    if route=='/en/services' and width in (390,1440):
     filename='services-motion-'+('mobile' if width==390 else 'desktop')+'.png'
     page.screenshot(path=str(OUT/filename),full_page=True,animations='disabled')
     results['screenshots'].append(filename)
   if width==1440:
    page.set_content(hydrate(client.get('/en/').text),wait_until='load')
    page.wait_for_timeout(200)
    animations=page.locator('.stage-relief').first.evaluate('(el)=>getComputedStyle(el).animationName')
    check('Hero clay shape morphing runs', 'vora-organic-morph' in animations,animations)
    stage=page.locator('.hero-art .clay-stage')
    stage.hover(position={'x':170,'y':110},force=True)
    tile=page.locator('.service-tile').first
    tile.scroll_into_view_if_needed();tile.hover(position={'x':90,'y':100},force=True)
    check('No pointer tracking listeners',
          not page.evaluate("() => /pointermove|mousemove/.test(Array.from(document.scripts).map(s=>s.textContent).join(''))"))
    check('No pointer reactive hero rotation',
          not stage.evaluate('(el)=>el.style.getPropertyValue("--stage-ry")'))
    check('No pointer reactive service tilt',
          not tile.evaluate('(el)=>el.style.getPropertyValue("--tilt-y")'))
    progress=page.locator('.vora-scroll-progress__fill').evaluate('(el)=>el.style.transform')
    check('Scroll progress updates',progress!='scaleX(0)' and progress.startswith('scaleX('),progress)
    page.set_content(hydrate(client.get('/en/request-quote').text),wait_until='load')
    page.locator('select[name="mode"]').select_option('international-freight-forwarding/air-import')
    page.locator('input[name="origin"]').fill('Jakarta')
    page.locator('input[name="destination"]').fill('Singapore')
    summary=page.locator('[data-vora-rfq-summary] strong').inner_text()
    check('RFQ reactive route overview','Jakarta' in summary and 'Singapore' in summary and 'Air Import' in summary,summary)
    page.screenshot(path=str(OUT/'rfq-motion-desktop.png'),full_page=True,animations='disabled')
    results['screenshots'].append('rfq-motion-desktop.png')
   if width==390:
    page.set_content(hydrate(client.get('/en/').text),wait_until='load')
    menu=page.locator('.mobile-nav>summary');menu.click();page.wait_for_timeout(120)
    check('Touch-width navigation opens',page.locator('.mobile-nav').get_attribute('open') is not None)
    page.keyboard.press('Escape')
    check('Mobile navigation closes on Escape',page.locator('.mobile-nav').get_attribute('open') is None)
   ctx.close()
  # Reduced motion: ambient loops stop, pointer tilt disabled, form interaction still live.
  reduced_ctx=browser.new_context(viewport={'width':1280,'height':800},reduced_motion='reduce')
  reduced_page=reduced_ctx.new_page();reduced_page.set_content(hydrate(client.get('/en/').text),wait_until='load')
  ambient=reduced_page.locator('.stage-relief').first.evaluate('(el)=>getComputedStyle(el).animationDuration')
  check('Reduced motion turns off ambient animation',float(ambient.replace('s',''))<.01,ambient)
  check('Reduced motion contains no pointer enhancements',not reduced_page.evaluate('document.documentElement.classList.contains("vora-enhanced-motion")'))
  reduced_ctx.close()
  # Short real browser recording documenting motion (not a mock animation).
  recording_ctx=browser.new_context(viewport={'width':1280,'height':720},device_scale_factor=1,record_video_dir=str(OUT),record_video_size={'width':1280,'height':720})
  record=recording_ctx.new_page();record.set_content(hydrate(client.get('/en/').text),wait_until='load');record.wait_for_timeout(850)
  record.mouse.move(1020,280);record.wait_for_timeout(450)
  record.mouse.move(780,460,steps=18);record.wait_for_timeout(550)
  record.mouse.wheel(0,640);record.wait_for_timeout(1100)
  first=record.locator('.service-tile').first
  first.hover(position={'x':150,'y':125},force=True);record.wait_for_timeout(1250)
  record.mouse.wheel(0,520);record.wait_for_timeout(1000)
  record.mouse.wheel(0,780);record.wait_for_timeout(1100)
  video_path=record.video.path()
  recording_ctx.close()
  results['video']=str(video_path)
  browser.close()
 results['pageerrors']=errors
 check('No browser JavaScript exceptions',not errors,errors[:4] if errors else None)
 check('No horizontal overflow or broken images in tested routes',all(r['status']=='PASS' for r in results['routes']),[r for r in results['routes'] if r['status']!='PASS'][:6])
 (OUT/'MOTION_QA_RESULTS.json').write_text(json.dumps(results,indent=2,ensure_ascii=False))
 print('RESULTS',len(results['routes']),'route/viewport combos',len(results['checks']),'functional checks',flush=True)
 if not all(x['status']=='PASS' for x in results['checks']):sys.exit(1)
