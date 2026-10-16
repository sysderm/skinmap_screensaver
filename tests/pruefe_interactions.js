"use strict";
const {chromium}=require('playwright'),fs=require('node:fs'),http=require('node:http');
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const html=fs.readFileSync('index.html','utf8').replace(/const ATLAS = "[^"]*";/,'const ATLAS = "";');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=','base64');
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const object='objects/'+sha(png)+'.webp';
let badHash=false,unavailable=false;
const cases=['a','b'].map(id=>({id,bild:'/'+id+'.png',overlay:'/overlay.png',diagnose:'Test diagnosis '+id,
  modality:'dermoscopy',fitz:'II',alter:42,region:'Back',datensatz:'ISIC 2020',beschreibung:'Synthetic description',
  befunde:[{term:'Synthetic feature',ort:'Centre',farbe:'#f5a144'}]}));
const server=http.createServer((req,res)=>{
  const url=req.url.split('?')[0];
  if(url.endsWith('manifest.json')){
    if(unavailable){res.writeHead(503);return res.end();}
    const entries={};for(const source of ['/a.png','/b.png','/overlay.png']) entries[sha(source)]={path:object,source_sha256:badHash?'0'.repeat(64):sha(png)};
    res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({version:1,entries}));
  }
  if(url.endsWith('.json')){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({bilder:cases}));}
  if(url.endsWith('.png')||url.endsWith('.webp')){res.setHeader('Content-Type','image/png');return res.end(png);}
  res.setHeader('Content-Type','text/html');res.end(html);
});
(async()=>{
  let browser;
  try{
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
    const page=await browser.newPage({viewport:{width:1366,height:1024}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/fonts.googleapis.com/**',route=>route.abort());
    const now=Math.floor(Date.now()/60000)*60000+1000;
    await page.clock.install({time:now});await page.clock.pauseAt(now+1000);
    const open=async()=>{
      await page.goto('http://127.0.0.1:'+server.address().port+'/');
      await page.clock.runFor(500);
      await page.waitForFunction(()=>document.querySelector('#tafelHuelle img')?.naturalWidth>0);
    };
    await open();
    await page.waitForFunction(()=>!document.getElementById('upscaledImage').disabled);
    const slot=await page.evaluate(()=>aktuellerPlatz),deadline=await page.evaluate(()=>trainingRevealAt);
    assert.equal(await page.locator('#realImage').getAttribute('aria-pressed'),'true');
    await page.locator('#upscaledImage').click();
    await page.waitForFunction(()=>activeUpscaled);
    assert.equal(await page.evaluate(()=>aktuellerPlatz),slot,'Quality toggle must not advance the case');
    assert.equal(await page.evaluate(()=>trainingRevealAt),deadline,'Quality toggle must preserve the timer');
    assert(await page.locator('#tafelHuelle img').getAttribute('src').then(s=>s.includes('/upscaled/objects/')));
    await page.locator('#realImage').click();await page.waitForFunction(()=>!activeUpscaled);
    assert.equal(await page.locator('#imageDataset').textContent(),'Dataset: ISIC 2020');
    await page.locator('#tafelHuelle').click();
    assert.equal(await page.evaluate(()=>document.getElementById('karte').classList.contains('awaiting-diagnosis')),false);
    assert.equal(await page.locator('#trainingCycle').getAttribute('aria-valuetext'),'Feedback');
    assert.equal(await page.evaluate(()=>aktuellerPlatz),slot);
    await page.locator('#tafelHuelle').click();
    await page.waitForFunction(()=>document.querySelector('#tafelHuelle img')?.dataset.overlay==='1');
    assert.equal(await page.locator('#trainingCycle').getAttribute('aria-valuetext'),'Lernen');
    const reveal=await page.evaluate(()=>trainingRevealAt);
    await page.waitForFunction(()=>!document.getElementById('upscaledImage').disabled);
    await page.locator('#upscaledImage').click();await page.waitForFunction(()=>activeUpscaled);
    assert.equal(await page.locator('#tafelHuelle img').getAttribute('data-overlay'),'1');
    assert.equal(await page.evaluate(()=>trainingRevealAt),reveal);
    await page.locator('#tafelHuelle').click();
    await page.waitForFunction(previous=>aktuellerPlatz===previous+1&&trainingRevealAt!==null,slot);
    assert.equal(await page.locator('#trainingCycle').getAttribute('aria-valuetext'),'Diagnose stellen');
    assert(await page.evaluate(()=>document.getElementById('karte').classList.contains('awaiting-diagnosis')));
    const elapsed=await page.evaluate(()=>TAKT_MS-selectionRest(Date.now()));assert(elapsed<1000);
    // Clock progress after a manual advance must still produce the next case.
    const start=await page.evaluate(()=>manualStart);
    await page.clock.setSystemTime(start+60001);await page.evaluate(()=>tick());
    await page.waitForFunction(previous=>aktuellerPlatz===previous+2,slot);
    for(const viewport of [{width:1366,height:1024},{width:1024,height:768},{width:768,height:1024}]){
      await page.setViewportSize(viewport);await page.evaluate(()=>fitCockpit());
      assert(await page.evaluate(()=>{
        const image=document.getElementById('tafelHuelle').getBoundingClientRect(),tools=document.querySelector('.image-tools').getBoundingClientRect();
        return image.bottom<=tools.top+1&&tools.bottom<=innerHeight&&document.documentElement.scrollWidth<=innerWidth;
      }));
    }
    badHash=true;await open();await page.waitForFunction(()=>!upscaleBusy);
    assert(await page.locator('#upscaledImage').isDisabled(),'Mismatched source bytes reject stale AI image');
    unavailable=true;await open();await page.waitForFunction(()=>!upscaleBusy);
    assert(await page.locator('#upscaledImage').isDisabled(),'Cache outage retains original');
    assert(await page.locator('#tafelHuelle img').getAttribute('src').then(s=>!s.includes('upscaled')));
    assert.deepEqual(errors,[]);
    console.log('Interactions passed: Real/Upscaled, source binding, outage fallback, independent timer, overlay annotations, click-through stages/new image, automatic progression and 3 viewport layouts.');
  }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1});
