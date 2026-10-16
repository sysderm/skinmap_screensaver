"use strict";
const fs = require("node:fs"), vm = require("node:vm"), assert = require("node:assert/strict");
const html = fs.readFileSync(require("node:path").join(__dirname, "../index.html"), "utf8");
const script = html.split('<script>')[1].split('</script>')[0].split('document.addEventListener("visibilitychange"')[0];
const context = vm.createContext({location:{search:"",hash:"",hostname:"localhost"},URLSearchParams,URL,AbortController,setTimeout,clearTimeout,document:{getElementById:()=>null}});
vm.runInContext(script, context);
const run = code => vm.runInContext(code, context);
for(const value of [null, undefined, "", "  ", "benign", " MALIGNANT ", "Unknown", "ohne Beschriftung", 42]){
  context.value = value;
  assert.equal(run('konkreteDiagnose(value)'), false);
}
for(const value of ["Melanoma", "benign lichenoid keratosis", "Malignant melanoma", "Basal cell carcinoma"]){
  context.value = value;
  assert.equal(run('konkreteDiagnose(value)'), true);
}
assert.equal(run(`normalisiere({bilder:[
  {condition:'benign',modality:'dermoscopy'},
  {condition:' MALIGNANT ',modality:'dermoscopy'},
  {modality:'dermoscopy'},
  {condition:'  ',modality:'dermoscopy'},
  {condition:'benign',icd_description:'Melanocytic naevus',modality:'dermoscopy'},
  {diagnose:'malignant',condition:'Melanoma',modality:'dermoscopy'},
  {condition:'benign lichenoid keratosis',modality:'dermoscopy'},
  {condition:'Melanoma',modality:'clinical'}
]}).liste.map(e=>e.diagnose).join('|')`), 'Melanocytic naevus|Melanoma|benign lichenoid keratosis');
assert.equal(run(`ausZeile({condition:'benign',icd_description:' Melanocytic naevus '}).diagnose`), 'Melanocytic naevus');
assert.equal(run(`ausZeile({condition:' ',icd_description:'Basal cell carcinoma'}).diagnose`), 'Basal cell carcinoma');
assert.equal(run(`ausZeile({condition:'malignant',icd_description:'unknown'}).diagnose`), 'ohne Beschriftung');
assert.equal(run('diagnoseBedingung({})'), 'FALSE');
assert(run(`diagnoseBedingung({condition:1,icd_description:1}).includes(' OR ')`));
run(`let received; meineAnsicht='bild'; fuellTafel=e=>received=e; drawMap=()=>{};`);
for(const diagnose of ['benign', ' MALIGNANT ', '', 'ohne Beschriftung']){
  context.value = diagnose;
  run(`rendere({index:1,anzahl:2,eintrag:{diagnose:value,modality:'dermoscopy',bild:'forbidden'}})`);
  assert.equal(run('received.holding'), true);
}
run(`rendere({index:1,anzahl:2,eintrag:{diagnose:'Malignant melanoma',modality:'dermoscopy'}})`);
assert.equal(run('received.diagnose'), 'Malignant melanoma');
run('FOLGE=[]');
assert.equal(run('eintragFuer(Date.now()).eintrag.holding'), true);

// Emit SQL for an independent DuckDB integration check without clinical data.
if(process.argv.includes('--sql')) console.log(run('diagnoseBedingung({condition:1,icd_description:1})'));
else console.log('Diagnosis filter: generic/missing labels, specific ICD fallback, named diagnoses, modality, empty list and final render guard passed.');
