"""Regression check for fully contained VORA service artwork; local Chromium SSR rendering."""
import sys
from pathlib import Path
from urllib.parse import urlsplit, unquote
import re, base64, mimetypes, json
from playwright.sync_api import sync_playwright
from fastapi.testclient import TestClient
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from vora.main import app
ROOT=Path(__file__).resolve().parents[1]
STATIC=ROOT/'vora'/'static'
OUT=ROOT/'previews'

def hydrate(markup):
 def style(m):
  path=urlsplit(m.group(1)).path
  f=STATIC/unquote(path[len('/static/'):])
  return '<style>'+f.read_text()+'</style>' if f.is_file() else m.group(0)
 markup=re.sub(r'<link rel="stylesheet" href="(/static/[^"]+)">',style,markup)
 def img(m):
  path=urlsplit(m.group(1)).path
  f=STATIC/unquote(path[len('/static/'):])
  mime=mimetypes.guess_type(f.name)[0] or 'application/octet-stream'
  return 'src="data:'+mime+';base64,'+base64.b64encode(f.read_bytes()).decode()+'"' if f.is_file() else m.group(0)
 return re.sub(r'src="(/static/[^"]+)"',img,markup).replace('loading="lazy"','loading="eager"')

if __name__ == '__main__':
 results=[]
 with TestClient(app) as client, sync_playwright() as pw:
  html=hydrate(client.get('/en/').text)
  browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
  for width in [360,390,768,900,1024,1440,1920]:
   page=browser.new_page(viewport={'width':width,'height':960},device_scale_factor=1)
   page.set_content(html,wait_until='load',timeout=25000)
   page.wait_for_timeout(50)
   data=page.evaluate('''() => {
      const tile=document.querySelector('.service-tile--1');
      const art=tile.querySelector('.tile-art');const copy=tile.querySelector('.tile-content');
      const bounds=e=>{let b=e.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height,right:b.right,bottom:b.bottom}};
      const card=bounds(tile),image=bounds(art),content=bounds(copy);
      return {card,image,content,scrollWidth:document.documentElement.scrollWidth,
              visible:!!art.naturalWidth,
              objectFit:getComputedStyle(art).objectFit,
              mobile:matchMedia('(max-width:900px)').matches}
   }''')
   card,art,copy=data['card'],data['image'],data['content']
   safe=(art['x']>=card['x']-2 and art['right']<=card['right']+2 and art['y']>=card['y']-2 and art['bottom']<=card['bottom']+2)
   if data['mobile']:
    separate=copy['y']>=art['bottom']-15
   else:
    separate=copy['right']<=art['x']+3
   okay=safe and separate and data['scrollWidth']<=width+2 and data['visible'] and data['objectFit']=='contain'
   results.append({'width':width,'status':'PASS' if okay else 'FAIL', 'contained':safe,'separate':separate,'scrollWidth':data['scrollWidth'], 'art':art,'content':copy})
   if width in (390,1440):
    page.locator('.service-tile--1').screenshot(path=str(OUT/('service-art-contained-'+str(width)+'.png')),animations='disabled')
   print(width,results[-1]['status'],'contained',safe,'separate',separate,flush=True)
   page.close()
  browser.close()
 (OUT/'SERVICE_ART_QA.json').write_text(json.dumps(results,indent=2))
 if any(r['status']!='PASS' for r in results):sys.exit(1)
