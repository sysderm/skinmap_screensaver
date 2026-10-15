// Apollo-Batch mit Lastmessung und adaptiver Drosselung (AIMD). Nur fuer Apollo; CDWH nie parallel.
import fs from 'fs'; import path from 'path';
const [root, limitArg, maxArg] = process.argv.slice(2);
const limit = Number(limitArg)||Infinity, MAX = Math.min(Number(maxArg)||4, 6);
const env = Object.fromEntries(fs.readFileSync((process.env.APOLLO_ENV || 'C:/Users/navarinia/261007_Klinikassistent/.env'),'utf8').split(/\r?\n/).filter(l=>/^[A-Z_]+=/.test(l)).map(l=>[l.slice(0,l.indexOf('=')), l.slice(l.indexOf('=')+1).trim().replace(/^["']|["']$/g,'')]));
const prompt = fs.readFileSync(path.join(root,'prompt_beschreibung_v1.1.txt'),'utf8');
const imgDir = path.join(root,'images'), outDir = path.join(root,'beschreibungen_roh'), errDir = path.join(root,'beschreibungen_roh_fehler');
fs.mkdirSync(outDir,{recursive:true}); fs.mkdirSync(errDir,{recursive:true});
const logF = path.join(root,'apollo_last.csv'); if(!fs.existsSync(logF)) fs.writeFileSync(logF,'zeit,id,latenz_ms,status,parallel,tokens_ein,tokens_aus\n');
const files = fs.readdirSync(imgDir).filter(f=>f.endsWith('.jpg')).filter(f=>!fs.existsSync(path.join(outDir,f.replace('.jpg','.json')))).slice(0,limit);
const med = a => { const s=[...a].sort((x,y)=>x-y); return s.length? s[Math.floor(s.length/2)] : 0; };
const p95 = a => { const s=[...a].sort((x,y)=>x-y); return s.length? s[Math.min(s.length-1,Math.floor(s.length*.95))] : 0; };
let conc = 1, active = 0, i = 0, ok = 0, bad = 0, pauseUntil = 0, base = null; const lat=[], win=[], t0=Date.now(); let maxReached=1, drosselungen=0;
async function call(id,b64){
  const t=Date.now(); let status='ok', usage={};
  try{
    const r = await fetch(env.LLM_URL,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${env.LLM_API_KEY}`},signal:AbortSignal.timeout(300000),
      body: JSON.stringify({model:env.LLM_MODEL,temperature:0,max_tokens:6000,messages:[{role:'system',content:prompt},{role:'user',content:[{type:'text',text:`image_id: ${id}\nBeschreibe dieses eine Bild gemäß Spezifikation. Antworte nur mit dem JSON-Objekt.`},{type:'image_url',image_url:{url:`data:image/jpeg;base64,${b64}`}}]}]})});
    status = String(r.status); if(!r.ok) throw Object.assign(new Error('HTTP '+r.status),{http:r.status});
    const j = await r.json(); usage=j.usage||{}; return {text:j.choices[0].message.content, ms:Date.now()-t, status, usage};
  }catch(e){ e.ms=Date.now()-t; e.status = e.http? String(e.http) : (e.name==='TimeoutError'?'timeout':'netz'); throw e; }
}
function log(id,ms,status,u){ fs.appendFileSync(logF,[new Date().toISOString(),id,ms,status,conc,u?.prompt_tokens??'',u?.completion_tokens??''].join(',')+'\n'); }
function bewerten(ms,status){
  win.push({ms,fehler: status!=='200'}); if(status==='200') lat.push(ms);
  if(base===null){ if(lat.length>=3){ base = med(lat); console.log(`Basislinie (1 parallel): ${Math.round(base)} ms`); } return; }
  const fehler = win.slice(-10).some(w=>w.fehler);
  if(fehler){ if(conc>1){conc--; drosselungen++;} pauseUntil = Date.now()+30000; win.length=0; console.log('Fehler/Timeout -> drossele auf',conc,'und pausiere 30 s'); return; }
  if(win.length>=10){
    const m = med(win.map(w=>w.ms)); win.length=0;
    if(m > base*1.6){ if(conc>1){conc--; drosselungen++;} console.log(`Latenz ${Math.round(m)} ms > 1.6x Basis -> ${conc} parallel`); }
    else if(m < base*1.3 && conc<MAX){ conc++; maxReached=Math.max(maxReached,conc); console.log(`Latenz ${Math.round(m)} ms ok -> ${conc} parallel`); }
  }
}
async function one(f){
  const id=f.replace('.jpg',''), b64=fs.readFileSync(path.join(imgDir,f)).toString('base64'); let raw='';
  for(let t=0;t<3;t++){
    try{
      const r = await call(id,b64); raw=r.text; log(id,r.ms,r.status,r.usage); bewerten(r.ms,r.status);
      const j = JSON.parse(raw.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g,'')); if(!j.images||j.images.length!==1) throw new Error('images!=1');
      fs.writeFileSync(path.join(outDir,id+'.json'), JSON.stringify(j,null,1)); ok++; return;
    }catch(e){ if(e.ms!==undefined && !raw){ log(id,e.ms,e.status,null); bewerten(e.ms,e.status); }
      if(t==2){ fs.writeFileSync(path.join(errDir,id+'.txt'), String(e.message||e)+'\n\n'+raw); bad++; return; } await new Promise(r=>setTimeout(r,2000*(t+1))); }
  }
}
const tasks=[];
while(i<files.length || active>0){
  if(i<files.length && active<(base===null?1:conc) && Date.now()>=pauseUntil){ active++; tasks.push(one(files[i++]).finally(()=>{active--; const n=ok+bad; if(n%20===0) console.log(`ok ${ok} fehler ${bad} parallel ${conc} (${Math.round((Date.now()-t0)/1000)}s)`);})); }
  else await new Promise(r=>setTimeout(r,200));
}
await Promise.all(tasks);
const min=(Date.now()-t0)/60000;
console.log('LAST-ZUSAMMENFASSUNG',JSON.stringify({ok,fehler:bad,minuten:+min.toFixed(1),proMin:+(ok/min).toFixed(1),latenzMedianMs:Math.round(med(lat)),latenzP95Ms:Math.round(p95(lat)),basislinieMs:Math.round(base||0),maxParallel:maxReached,drosselungen}));
