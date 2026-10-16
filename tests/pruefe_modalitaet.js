"use strict";
const fs = require("node:fs"), vm = require("node:vm"), assert = require("node:assert/strict");
const html = fs.readFileSync(require("node:path").join(__dirname, "../index.html"), "utf8");
const script = html.replace(/const ATLAS = "[^"]*";/, 'const ATLAS = "https://skinmap.ngrok.io";').split('<script>')[1].split('</script>')[0].split('document.addEventListener("visibilitychange"')[0];
const context = vm.createContext({location:{search:"",hash:"",hostname:"localhost"},URLSearchParams,URL,AbortController,setTimeout,clearTimeout,document:{getElementById:()=>null}});
vm.runInContext(script,context);
const run = code => vm.runInContext(code,context);
assert.equal(run(`normalisiere({bilder:[
 {condition:'A',modality:'dermoscopy'},
 {condition:'B',modality:'clinical'},
 {condition:'C',modality:'TBP'},
 {condition:'D',modality_pred:'dermoscopy'},
 {condition:'E',modality:' DERMOSCOPY '}
]}).liste.map(e=>e.diagnose).join(',')`),'A,E');
assert.equal(run(`ausZeile({_row_index:1,condition:'A',modality:'dermoscopy'}).modality`),'dermoscopy');
assert.equal(run(`eintragFuer(Date.now()).eintrag.holding`),true);
run(`let received; meineAnsicht='bild'; fuellTafel=e=>received=e;
drawMap=()=>{}; reviewed.add(1);
rendere({index:1,anzahl:2,eintrag:{diagnose:'Clinical',modality:'clinical',bild:'forbidden'}});`);
assert.equal(run('received.holding'),true);
run(`rendere({index:1,anzahl:2,eintrag:{diagnose:'Dermoscopic',modality:'dermoscopy'}})`);
assert.equal(run('received.diagnose'),'Dermoscopic');
console.log('Modalitätsfilter: Liste, fehlende Werte, Modellwerte und Darstellung geprüft.');
run(`atlasSql=async sql=>sql==='DESCRIBE dataset'
 ? [{column_name:'_row_index',column_type:'BIGINT'},{column_name:'image',column_type:'VARCHAR'}] : [{n:5}];`);
(async()=>{
  await assert.rejects(run('atlasStart()'),e=>e.message==='Modalität fehlt');
  run(`atlasSql=async sql=>sql==='DESCRIBE dataset'
   ? ['_row_index','image','modality'].map(column_name=>({column_name,column_type:'VARCHAR'})) : [{n:5}];`);
  context.fetch=async()=>({ok:false});
  await run('atlasStart()');
  assert(run(`atlas.filter.includes("lower(trim(\\\"modality\\\")) = 'dermoscopy'")`));
  console.log('Atlas: fehlende Modalität sperrt Zugriff; SQL-Auswahl verlangt dermoscopy.');
})().catch(e=>{console.error(e);process.exitCode=1});
