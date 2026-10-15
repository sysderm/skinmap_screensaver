import fs from 'fs'; import path from 'path'; import {execFileSync} from 'child_process';
const R='C:/Users/navarinia/ISIC2018_Task2_Eval/', W=96, H=72;
const ATTR={pigment_network:['lines.reticular'],negative_network:['lines.negative_network'],streaks:['lines.radial','pseudopods.pseudopods','pseudopods.starburst'],milia_like_cyst:['clods.milia_like'],globules:['clods.globules','clods.peripheral_rim','dots.pigmented','clods.cobblestone']};
const mask=(id,a)=>{const f=`${R}masks/ISIC_${String(id).padStart(7,'0')}_attribute_${a}.png`;const b=execFileSync('ffmpeg',['-v','error','-i',f,'-vf',`scale=${W}:${H}:flags=area`,'-f','rawvideo','-pix_fmt','gray','-'],{maxBuffer:1e7});return b};
const stat=b=>{let n=0,sx=0,sy=0;for(let y=0;y<H;y++)for(let x=0;x<W;x++){const v0=b[y*W+x],v=Math.max(0,v0-16);if(v>1){const w=v/219;n+=w;sx+=w*x;sy+=w*y}}return n?{area:n/(W*H),cx:sx/n/W,cy:sy/n/H}:null};
const truthLabel=s=>{if(!s)return null;if(s.area>0.4)return'diffus';const dx=s.cx-.5,dy=s.cy-.5;if(Math.hypot(dx,dy)<.12)return'zentral';return Math.abs(dx)>Math.abs(dy)?(dx<0?'links':'rechts'):(dy<0?'oben':'unten')};
const dirsFromHour=h=>{h=((h%12)+12)%12||12;const s=new Set();if(h>=11||h<=1)s.add('oben');if(h>=2&&h<=4)s.add('rechts');if(h>=5&&h<=7)s.add('unten');if(h>=8&&h<=10)s.add('links');if(h===1||h===2)s.add(h===1?'rechts':'oben');if(h===4||h===5)s.add(h===4?'unten':'rechts');if(h===7||h===8)s.add(h===7?'links':'unten');if(h===10||h===11)s.add(h===10?'oben':'links');return s};
const predLabels=t=>{t=t.toLowerCase();const s=new Set();if(/diffus|gesamte|ganze|überall/.test(t))return{diffus:true,set:s};
 if(/zentral|mittig|\bmitte/.test(t))s.add('zentral');
 for(const m of t.matchAll(/(\d{1,2})\s*(?:[–-]\s*(\d{1,2})\s*)?uhr/g)){const a=+m[1],b=m[2]?+m[2]:a;let h=a;for(let k=0;k<12;k++){dirsFromHour(h).forEach(d=>s.add(d));if(h%12===b%12)break;h=h%12+1}}
 if(/ober/.test(t))s.add('oben');if(/unter|unten/.test(t))s.add('unten');if(/links|linke/.test(t))s.add('links');if(/rechts|rechte/.test(t))s.add('rechts');return{diffus:false,set:s}};
const ids=fs.readdirSync(R+'beschreibungen_roh').map(f=>f.replace('.json',''));
const res=Object.fromEntries(Object.keys(ATTR).map(a=>[a,{tp:0,fp:0,fn:0,tn:0,loc:0,locHit:0,locBase:0,lr:0,lrHit:0,lrFlip:0}]));
for(const id of ids){const j=JSON.parse(fs.readFileSync(R+`beschreibungen_roh/${id}.json`)).images[0];const fs_=j.lesions?.[0]?.findings||[];
 for(const [a,codes] of Object.entries(ATTR)){const st=stat(mask(id,a));const mine=fs_.filter(f=>codes.includes(f.code)&&f.state==='present');const r=res[a];
  if(st&&mine.length)r.tp++;else if(st)r.fn++;else if(mine.length)r.fp++;else r.tn++;
  if(st&&mine.length){const tl=truthLabel(st);if(tl==='diffus')continue;const P=mine.map(f=>predLabels(f.distribution||''));if(P.some(p=>p.diffus))continue;const set=new Set(P.flatMap(p=>[...p.set]));if(!set.size)continue;
   r.loc++;if(set.has(tl))r.locHit++;if(tl==='zentral')r.locBase++;
   if(tl==='links'||tl==='rechts'){const opp=tl==='links'?'rechts':'links';if((set.has('links')||set.has('rechts'))&&!(set.has('links')&&set.has('rechts'))){r.lr++;if(set.has(tl))r.lrHit++;if(set.has(opp))r.lrFlip++}}}}}
const f=(x,d=2)=>isFinite(x)?x.toFixed(d):'–';let md=`# ISIC 2018 Task 2 – Vergleich Apollo (Prompt v1.1) vs. Expertenmasken\n\nBilder: ${ids.length} (Zufallsstichprobe aus Test+Validierung). Anwesenheit = Maske nicht leer; Apollo-Treffer = zugeordnete Befundcodes mit state=present.\n\n| Merkmal | Experten positiv | Apollo positiv | TP | FP | FN | TN | Präzision | Recall | F1 |\n|---|---|---|---|---|---|---|---|---|---|\n`;
for(const [a,r] of Object.entries(res)){const n=r.tp+r.fp+r.fn+r.tn,p=r.tp/(r.tp+r.fp),rc=r.tp/(r.tp+r.fn);md+=`| ${a} | ${r.tp+r.fn} (${f((r.tp+r.fn)/n*100,0)} %) | ${r.tp+r.fp} (${f((r.tp+r.fp)/n*100,0)} %) | ${r.tp} | ${r.fp} | ${r.fn} | ${r.tn} | ${f(p)} | ${f(rc)} | ${f(2*p*rc/(p+rc))} |\n`}
md+=`\n## Lage (nur Bilder, bei denen beide das Merkmal sehen und die Lage eindeutig ist)\n\n| Merkmal | n | Lage stimmt | Anteil | „Zentral“ wäre immer richtig bei | Seitenangaben (links/rechts) n | richtig | vertauscht |\n|---|---|---|---|---|---|---|---|\n`;
for(const [a,r] of Object.entries(res))md+=`| ${a} | ${r.loc} | ${r.locHit} | ${f(r.locHit/r.loc)} | ${f(r.locBase/r.loc)} | ${r.lr} | ${r.lrHit} | ${r.lrFlip} |\n`;
fs.writeFileSync(R+'ISIC_Vergleich.md',md);console.log(md);
