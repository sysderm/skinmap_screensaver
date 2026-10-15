import fs from 'fs';
const R='C:/Users/navarinia/Dermoskopie_Lehrbuch/';
const vocab={}; for(const l of fs.readFileSync(R+'prompt_beschreibung.txt','utf8').split('\n')){const m=l.match(/^([a-z]+\.[a-z_]+) \| (.+?) \| /); if(m) vocab[m[1]]=m[2];}
const man=fs.readFileSync(R+'manifest.csv','utf8').replace(/^\uFEFF/,'').split('\n').slice(1).filter(Boolean).map(l=>{const c=[...l.matchAll(/"((?:[^"]|"")*)"/g)].map(x=>x[1]);return {id:c[1],group:c[3],cond:c[4]}});
const gm=Object.fromEntries(man.map(x=>[x.id,x]));
const FB=/(melanom|karzinom|basaliom|bnaevus|bnävus|maligne|benigne|bösartig|gutartig|exophyt|verdächtig|krebs|bkeratose|dermatofibrom|hämangiom|bwarze|bnarbeb|bnarbig|regression|wachstum|entwickl|histolog|biopsie|exzision|empfehl)/i;
const FAM=['lines','clods','dots','circles','pseudopods','structureless','vessels','other'];
const issues={}, add=(k,id)=>(issues[k]||=[]).push(id);
const stats={}, rows=[];
for(const f of fs.readdirSync(R+'beschreibungen')){
  const id=f.replace('.json',''); const j=JSON.parse(fs.readFileSync(R+'beschreibungen/'+f)); const im=j.images[0];
  if(j.schema_version!=='1.0') add('schema_version',id);
  if(String(im.image_id)!==id) add('image_id_mismatch',id);
  const g=gm[id]?.group; (stats[g]||={n:0,f:{},unint:0}); stats[g].n++; if(im.assessment==='uninterpretable') stats[g].unint++;
  if((im.lesions||[]).length>3) add('>3 lesions',id);
  for(const l of im.lesions||[]){
    const cap=l.caption_de||''; if(cap.split(/\s+/).length>90) add('caption>90',id);
    const hit=cap.match(FB); if(hit) add('caption_forbidden:'+hit[1].toLowerCase(),id);
    if(!FAM.every(k=>l.family_assessments?.[k]) || Object.keys(l.family_assessments||{}).length!==8) add('family_assessments',id);
    if(!['symmetric','asymmetric','not_assessable'].includes(l.symmetry_color)) add('symmetry_value',id);
    if(l.border_visibility!=='complete' && (l.symmetry_color!=='not_assessable'||l.symmetry_structure!=='not_assessable')) add('symmetry_with_partial_border',id);
    if((l.findings||[]).length>25) add('>25 findings',id);
    const seen=new Set();
    for(const x of l.findings||[]){
      if(!vocab[x.code]) add('unknown_code',id); else { if(vocab[x.code]!==x.canonical_term) add('term_mismatch',id); if(x.code.split('.')[0]!==x.family) add('family_mismatch',id);}
      if(seen.has(x.code)) add('duplicate_code',id); seen.add(x.code);
      if(x.state==='present'&&x.visual_certainty!=='clear') add('present_not_clear',id);
      if(x.state==='absent'&&(x.observed_colors?.length||x.distribution)) add('absent_with_details',id);
      if(x.state==='present'){ stats[g].f[x.code]=(stats[g].f[x.code]||0)+1; }
      if(FB.test(x.observation_de||'')) add('observation_forbidden',id);
    }
  }
  if(!(im.lesions||[]).length) add('no_lesion',id);
}
const lines=['# QC-Bericht', `Dateien: ${fs.readdirSync(R+'beschreibungen').length}, Vokabular: ${Object.keys(vocab).length} Codes`,'','## Verstöße (Anzahl Bilder)'];
for(const [k,v] of Object.entries(issues).sort((a,b)=>b[1].length-a[1].length)) lines.push(`- ${k}: ${new Set(v).size}`);
lines.push('','## Häufigste Befunde je Diagnosegruppe (Anteil Bilder mit "present")');
for(const [g,s] of Object.entries(stats)){ const top=Object.entries(s.f).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([c,n])=>`${c} ${Math.round(100*n/s.n)}%`).join(', '); lines.push(`- ${g} (n=${s.n}, uninterpretable ${s.unint}): ${top}`);}
fs.writeFileSync(R+'QC_Bericht.md',lines.join('\n')); fs.writeFileSync(R+'qc_issues.json',JSON.stringify(issues));
console.log(lines.join('\n'));
