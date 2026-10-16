"use strict";
// Reuse actual display selection rules instead of duplicating SQL or routing.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const script = html.split('<script>')[1].split('</script>')[0].split('document.addEventListener("visibilitychange"')[0];
async function plan(mode, lookahead){
  const ctx = vm.createContext({location:{search:mode==='random'?'?mode=random':'',hash:'#combined',hostname:'dermatoskopie.ch'},
    URLSearchParams,URL,AbortController,AbortSignal,setTimeout,clearTimeout,fetch,document:{getElementById:()=>null}});
  vm.runInContext(script,ctx);
  const atlas=vm.runInContext('ATLAS',ctx);
  if(!atlas){
    const dataPath=vm.runInContext('DATEN',ctx);
    ctx.input=JSON.parse(fs.readFileSync(path.resolve(__dirname,'..',dataPath),'utf8'));
    return vm.runInContext(`(()=>{
      const entries=gewichtet(normalisiere(input).liste,MISCHUNG_SAAT);
      const start=platz(Date.now()),jobs=[];
      for(let offset=0;offset<${lookahead};offset++){
        const entry=entries[(start+offset)%entries.length];
        if(entry?.bild) jobs.push({source:entry.bild});
        if(entry?.overlay) jobs.push({source:entry.overlay});
      }
      return jobs;
    })()`,ctx);
  }
  await vm.runInContext('atlasStart()',ctx);
  ctx.lookahead = lookahead;
  return vm.runInContext(`(async()=>{
    const start=platz(Date.now()), jobs=[];
    // Resolve only selected images; never save or log diagnosis/metadata.
    for(let offset=0;offset<lookahead;offset++){
      const r=await atlasEintrag(start+offset,true);
      if(r.eintrag.bild) jobs.push({source:r.eintrag.bild});
    }
    return jobs;
  })()`,ctx);
}
(async()=>{
  const lookahead=Number(process.argv[2] || 30);
  if(!Number.isInteger(lookahead)||lookahead<1||lookahead>120) throw Error('Invalid lookahead');
  const walk=await plan('neighbour',lookahead);
  const random=await plan('random',Math.min(lookahead,10));
  const unique=[...new Map([...walk,...random].map(j=>[j.source,j])).values()];
  process.stdout.write(JSON.stringify(unique));
})().catch(()=>{console.error('Upscale selection unavailable; no clinical contents logged.');process.exitCode=1});
