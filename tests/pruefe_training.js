"use strict";
const {chromium}=require("playwright");
const fs=require("node:fs"),path=require("node:path"),http=require("node:http"),assert=require("node:assert/strict");
const html=fs.readFileSync(path.join(__dirname,"../index.html"),"utf8").replace(/const ATLAS = "[^"]*";/,'const ATLAS = "";');
const png="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
const server=http.createServer((req,res)=>{
  if(req.url.startsWith('/vitrine.json')){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({bilder:[{id:'safe-test',bild:png,diagnose:'Test diagnosis',art:'Revealing subtitle',modality:'dermoscopy'}]}));}
  else{res.setHeader('Content-Type','text/html');res.end(html);}
});
const wait=()=>new Promise(r=>setTimeout(r,150));
(async()=>{
  let browser;
  try{
    await new Promise(r=>server.listen(0,'127.0.0.1',r));
    browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||undefined});
    const context=await browser.newContext();
    await context.route('**/fonts.googleapis.com/**',r=>r.abort());
    let now=Math.floor(Date.now()/60000)*60000+5000, readyAt=null;
    await context.route('**/api/display-ready?**',r=>{
      if(r.request().method()==='POST'&&readyAt===null) readyAt=now;
      return r.fulfill({json:readyAt===null?{ready:false}:{ready:true,remaining_ms:Math.max(0,15000-(now-readyAt))}});
    });
    const url='http://127.0.0.1:'+server.address().port;
    const meta=await context.newPage();await meta.clock.install({time:now});await meta.clock.pauseAt(now+1000);await meta.goto(url+'/#meta');await meta.clock.runFor(1000);await wait();
    const hidden=()=>meta.evaluate(()=>getComputedStyle(document.getElementById('diagnose')).visibility==='hidden'&&getComputedStyle(document.getElementById('unterzeile')).visibility==='hidden');
    assert(await hidden(),'No image announcement: both diagnosis fields hidden');
    const picture=await context.newPage();await picture.clock.install({time:now});await picture.clock.pauseAt(now+1000);await picture.goto(url+'/#bild');await picture.clock.runFor(1000);await wait();
    assert(await picture.evaluate(()=>document.querySelector('#tafelHuelle img').naturalWidth>0));
    assert.notEqual(readyAt,null,'Only the loaded image announces readiness');
    now=readyAt+14999;await meta.clock.setSystemTime(now);await meta.evaluate(()=>{trainingPollAt=0;tick()});await wait();await meta.evaluate(()=>tick());
    assert(await hidden(),'Still hidden at 14.999 seconds');
    now=readyAt+15000;await meta.clock.setSystemTime(now);await meta.evaluate(()=>{trainingPollAt=0;tick()});await wait();await meta.evaluate(()=>tick());
    assert(!(await hidden()),'Revealed after 15 seconds');
    readyAt=null;now=Math.floor(now/60000)*60000+60100;await meta.clock.setSystemTime(now);await meta.evaluate(()=>tick());await wait();
    assert(await hidden(),'Next image hides previous diagnosis immediately');
    console.log('Training: loaded image required; diagnosis/subtitle hidden before 15s; reveal and next-minute reset passed.');
  }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
