/** Browser QA against real pages + explicitly empty read-only Data API fixture.
 * Prerequisites: npm run build; npx playwright install chromium.
 * Run: node scripts/review-qa.mjs [--quick] [--dev]
 * Screenshots/report: .review-output/. No production writes or real emails.
 */
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
const quick = process.argv.includes('--quick'), dev = process.argv.includes('--dev')
const out = path.resolve(process.env.REVIEW_OUTPUT || '.review-output');fs.mkdirSync(out,{recursive:true})
const server = spawn(process.execPath,['scripts/review-server.mjs'], {env:{...process.env,REVIEW_MODE:dev?'dev':'production'},stdio:['ignore','pipe','pipe']})
const log = fs.createWriteStream(path.join(out,'server.log'));server.stdout.pipe(log);server.stderr.pipe(log)
let browser
const sleep = ms => new Promise(r=>setTimeout(r,ms))
const report={dataMode:'empty read-only loopback fixture; no live database workflows verified',checks:[],errors:[], screenshots:[]}
try {
 for(let i=0;i<90;i++){try{const r=await fetch('http://127.0.0.1:3100/en');if(r.ok)break}catch{}if(i===89)throw Error('Review server did not start');await sleep(1000)}
 browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_PATH||undefined,headless:true,args:['--no-sandbox','--no-zygote','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']})
 const context=await browser.newContext({viewport:{width:1440,height:1000}})
 const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message))
 const routes=quick?['','/services/domestic-distribution/ftl']:['','/about','/services','/solutions','/network','/insights','/faq','/contact','/request-quote','/privacy','/terms','/services/international-freight-forwarding','/services/international-freight-forwarding/air-import','/services/international-freight-forwarding/air-export','/services/international-freight-forwarding/sea-import','/services/international-freight-forwarding/sea-export','/services/customs-brokerage','/services/3pl-warehousing','/services/domestic-distribution','/services/domestic-distribution/ftl','/services/domestic-distribution/ltl','/services/domestic-distribution/fcl','/services/domestic-distribution/lcl','/services/domestic-distribution/air-freight','/services/project-cargo']
 const filter=process.argv.find(x=>x.startsWith('--routes='))?.slice(9).split(',')
 const selectedRoutes=process.argv.includes('--interactions-only')?[]:filter?routes.filter(x=>filter.includes(x)):routes
 const widths=quick?[1440,390]:[1920,1440,1024,768,390,360]
 for(const locale of quick?['en','id']:['en','id'])for(const route of selectedRoutes)for(const width of widths){
  await page.setViewportSize({width,height:width<600?844:1000})
  const url=`http://127.0.0.1:3100/${locale}${route}`
  const response=await page.goto(url,{waitUntil:'networkidle',timeout:90000});await page.evaluate(()=>document.fonts.ready)
  await page.waitForTimeout(1750)
  // Load each real lazy image through normal viewport entry before assessing completeness.
  const lazy = page.locator('img[loading=lazy]')
  for(let n=0;n<await lazy.count();n++){const im=lazy.nth(n);if(await im.isVisible()){await im.scrollIntoViewIfNeeded();await im.evaluate(e=>e.decode().catch(()=>{}))}}
  await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(100)
  const measurement=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,h1:document.querySelectorAll('h1').length,images:[...document.images].filter(x=>x.getBoundingClientRect().width>0&&x.getBoundingClientRect().height>0&&(!x.complete||x.naturalWidth===0)).map(x=>x.getAttribute('src')),phoneInputs:document.querySelectorAll('input[type="tel"]').length,adminLinks:[...document.querySelectorAll('a')].filter(x=>/^\/(?:en\/|id\/)?admin(?:\/|$)/.test(x.getAttribute('href')||'')).length,canonical:document.querySelector('link[rel="canonical"]')?.getAttribute('href')}))
  const check={locale,route:route||'/',width,status:response.status(),...measurement};report.checks.push(check)
  if(width===1440||width===390){const name=`${locale}-${route.replaceAll('/','_')||'home'}-${width}.png`;await page.screenshot({path:path.join(out,name),fullPage:true});report.screenshots.push(name)}
  if(response.status()!==200||measurement.overflow||measurement.h1!==1||measurement.images.length||measurement.phoneInputs||measurement.adminLinks)console.log('ISSUE',JSON.stringify(check))
 }
 // Keyboard menu and reduced-motion state use real mounted components.
 await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:3100/en',{waitUntil:'networkidle'})
 await page.locator('.v-burger>summary').focus();await page.keyboard.press('Enter');const open=await page.locator('.v-burger').getAttribute('open');await page.keyboard.press('Escape');report.menu={opened:open!==null,closed:await page.locator('.v-burger').getAttribute('open')===null}
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('http://127.0.0.1:3100/en/services/domestic-distribution/ftl',{waitUntil:'networkidle'});report.reducedMotion={headingVisible:await page.locator('h1').isVisible(),objectVisible:await page.locator('.a-stage>.a-object').isVisible()}
 // Exercise the real Server Action redirect without creating a lead or sending mail: the honeypot intentionally short-circuits.
 await page.goto('http://127.0.0.1:3100/en/contact',{waitUntil:'networkidle'})
 await page.locator('input[name=name]').fill('Local review bot');await page.locator('input[name=email]').fill('review@example.invalid');await page.locator('textarea[name=message]').fill('Synthetic honeypot test; must not be stored.');await page.locator('input[name=consent]').check()
 await page.locator('input[name=website]').evaluate(e=>{e.value='bot'})
 await page.getByRole('button',{name:'Send inquiry',exact:true}).click();await page.waitForURL(/sent=1/)
 await page.locator('.v-formcard > [role="status"]').waitFor({state:'visible',timeout:10000})
 report.honeypotSubmission={feedbackVisible:await page.locator('.v-formcard > [role="status"]').isVisible(),message:await page.locator('.v-formcard > [role="status"]').textContent(),persisted:false,mailSent:false,scope:'Bot short-circuit only; not a valid lead persistence test'}
 await page.goto('http://127.0.0.1:3100/en/request-quote?mode=domestic-distribution%2Fftl',{waitUntil:'networkidle'})
 report.quoteContext={selected:await page.locator('select[name=mode]').inputValue(),phoneInputs:await page.locator('input[type=tel]').count(),languageHref:await page.locator('.v-lang').first().getAttribute('href')}
 const unauth=await page.request.get('http://127.0.0.1:3100/admin',{maxRedirects:0});report.adminGate={status:unauth.status(),location:unauth.headers().location}
 await page.goto('http://127.0.0.1:3100/admin/login',{waitUntil:'networkidle'});report.loginLabels={email:await page.getByLabel('Email',{exact:true}).count(),password:await page.getByLabel('Password',{exact:true}).count()};await page.screenshot({path:path.join(out,'admin-login-390.png'),fullPage:true})
 report.metadata=[]
 for(const locale of ['en','id'])for(const route of routes){const res=await page.request.get(`http://127.0.0.1:3100/${locale}${route}`);const html=await res.text();const title=html.match(/<title>([\s\S]*?)<\/title>/)?.[1]||'';const description=html.match(/<meta name="description" content="([^"]*)"/)?.[1]||'';report.metadata.push({locale,route:route||'/',status:res.status(),title,description});}
 report.metadataPassed=report.metadata.every(x=>x.status===200&&x.title.length>0&&x.description.length>0)
 fs.writeFileSync(path.join(out,'home.html'),await (await page.request.get('http://127.0.0.1:3100/en')).text())
 report.failures=report.checks.filter(c=>c.status!==200||c.overflow||c.h1!==1||c.images.length||c.phoneInputs||c.adminLinks)
 report.passed=report.metadataPassed&&report.failures.length===0&&report.errors.length===0&&report.menu.opened&&report.menu.closed&&report.reducedMotion.headingVisible&&report.reducedMotion.objectVisible&&report.honeypotSubmission.feedbackVisible&&report.loginLabels.email===1&&report.loginLabels.password===1&&[302,307,308].includes(report.adminGate.status)
 if(!report.passed)process.exitCode=1
 console.log('Browser checks:',report.checks.length,'screenshots:',report.screenshots.length,'page errors:',report.errors.length)
} catch(e){report.fatal=String(e);console.error(e);process.exitCode=1} finally {fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));await browser?.close();server.kill('SIGTERM');log.end()}
