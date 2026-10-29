"""Refresh the local browser motion preview with art fully visible (not production hosting)."""
from pathlib import Path
from playwright.sync_api import sync_playwright
from fastapi.testclient import TestClient
from qa_service_art import hydrate, OUT
from vora.main import app
import subprocess

with TestClient(app) as client, sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 ctx=browser.new_context(viewport={'width':1280,'height':720},device_scale_factor=1,
                         record_video_dir=str(OUT), record_video_size={'width':1280,'height':720})
 page=ctx.new_page()
 page.set_content(hydrate(client.get('/en/').text),wait_until='load')
 page.wait_for_timeout(1000)
 page.evaluate('''() => window.scrollTo({top:540,behavior:'smooth'})''')
 page.wait_for_timeout(900)
 page.evaluate('''() => {const t=document.querySelector('.service-tile--1');
    window.scrollTo({top: window.scrollY+t.getBoundingClientRect().top-120,behavior:'smooth'});
 }''')
 page.wait_for_timeout(1300)
 page.locator('.service-tile--1').hover(position={'x':125,'y':210},force=True)
 page.wait_for_timeout(1800)
 page.evaluate('''() => window.scrollBy({top:720,behavior:'smooth'})''')
 page.wait_for_timeout(1200)
 page.evaluate('''() => window.scrollBy({top:430,behavior:'smooth'})''')
 page.wait_for_timeout(1100)
 video=page.video.path()
 ctx.close()
 browser.close()

out=OUT/'VORA_Motion_Experience.mp4'
subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(video),'-c:v','libx264','-preset','veryfast','-crf','22','-pix_fmt','yuv420p','-movflags','+faststart',str(out)],check=True)
print(out, out.stat().st_size)
