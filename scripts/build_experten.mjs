// Baut experten/ (Bilder, Overlays mit den Experten-Masken, vitrine.json) aus ISIC 2018 Task 2.
// Aufruf: node scripts/build_experten.mjs <Ordner mit raw/ und masks/> <isic_meta.json>
import fs from 'fs'; import path from 'path'; import {execFile} from 'child_process'; import {promisify} from 'util';
const run = promisify(execFile);
const [src, metaF] = process.argv.slice(2);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const out = path.join(root, 'experten'); for (const d of ['bilder', 'overlay']) fs.mkdirSync(path.join(out, d), {recursive: true});
const meta = JSON.parse(fs.readFileSync(metaF));
const ATTR = [['pigment_network', 'Pigmentnetz', '#ff9f1c'], ['negative_network', 'Negatives Netz', '#2ec4ff'], ['streaks', 'Streaks', '#ff4fd8'], ['milia_like_cyst', 'Milia-ähnliche Zysten', '#ffe45e'], ['globules', 'Globules / Dots', '#4cd964']];
const DIAG = {'Nevus': 'Melanozytärer Nävus', 'Melanoma, NOS': 'Melanom', 'Melanoma Invasive': 'Invasives Melanom', 'Melanoma in situ': 'Melanoma in situ', 'Seborrheic keratosis': 'Seborrhoische Keratose',
  'Atypical melanocytic neoplasm': 'Atypische melanozytäre Neoplasie', 'Squamous cell carcinoma in situ': 'Plattenepithelkarzinom in situ', 'Lichen planus like keratosis': 'Lichenoide Keratose',
  'Collision - At least one malignant proliferation': 'Kollisionsläsion (mind. eine maligne Komponente)', 'Collision - Only benign proliferations': 'Kollisionsläsion (nur benigne)',
  'Atypical proliferative nodules in congenital melanocytic nevus': 'Atypische proliferative Knoten im kongenitalen Nävus', 'Solar or actinic keratosis': 'Aktinische Keratose',
  'Mucosal melanotic macule': 'Mukosale melanotische Makula', 'Atypical intraepithelial melanocytic proliferation': 'Atypische intraepitheliale melanozytäre Proliferation'};
const SITE = {'Trunk': 'Rumpf', 'Lower extremity': 'Untere Extremität', 'Upper extremity': 'Obere Extremität', 'Head and neck': 'Kopf/Hals', 'Anterior chest': 'Brust', 'Anterior abdomen': 'Bauch', 'Upper back': 'Oberer Rücken', 'Lower back': 'Unterer Rücken', 'Mid back': 'Rücken', 'Face': 'Gesicht', 'Lateral thigh': 'Oberschenkel', 'Anterior thigh': 'Oberschenkel', 'Calf': 'Unterschenkel', 'Shin': 'Unterschenkel', 'Lateral abdomen': 'Flanke'};
const hex = h => '0x' + h.slice(1);
async function dims(f) { const {stdout} = await run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', f]); const [w, h] = stdout.trim().split(',').map(Number); return {w, h}; }
async function maskHas(id, a) { // Maske nicht leer? (auf 48x36 verkleinert; Schwarz = 16)
  const {stdout} = await run('ffmpeg', ['-v', 'error', '-i', path.join(src, 'masks', `${id}_attribute_${a}.png`), '-vf', 'scale=48:36:flags=area', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], {encoding: 'buffer', maxBuffer: 1e7});
  return [...stdout].some(v => v > 17);
}
async function one(id) {
  const base = path.join(out, 'bilder', id + '.jpg'), ov = path.join(out, 'overlay', id + '.jpg');
  if (!fs.existsSync(base)) await run('ffmpeg', ['-v', 'error', '-y', '-i', path.join(src, 'raw', id + '.jpg'), '-vf', "scale='if(gt(iw,ih),min(800,iw),-2)':'if(gt(iw,ih),-2,min(800,ih))'", '-q:v', '5', base]);
  const present = []; for (const [a] of ATTR) present.push(await maskHas(id, a));
  if (present.some(Boolean) && !fs.existsSync(ov)) {
    const {w, h} = await dims(base); const inputs = ['-i', base]; const fc = []; let last = '0:v', n = 0;
    ATTR.forEach(([a, , col], k) => { if (!present[k]) return; n++; inputs.push('-i', path.join(src, 'masks', `${id}_attribute_${a}.png`));
      fc.push(`[${n}:v]scale=${w}:${h}:flags=neighbor,format=gray,lut=y='clip((val-16)*0.52,0,255)'[a${n}]`, `color=c=${hex(col)}:s=${w}x${h},format=rgba[c${n}]`, `[c${n}][a${n}]alphamerge[o${n}]`, `[${last}][o${n}]overlay=shortest=1[v${n}]`); last = 'v' + n; });
    await run('ffmpeg', ['-v', 'error', '-y', ...inputs, '-filter_complex', fc.join(';'), '-map', `[${last}]`, '-frames:v', '1', '-q:v', '5', ov]);
  }
  return present;
}
const ids = Object.keys(meta).sort(); const eintraege = []; let skip = {kind: 0, genital: 0}, i = 0;
const ok = ids.filter(id => { const m = meta[id]; if (m.age_approx != null && m.age_approx < 18) { skip.kind++; return false; } if (/genit/i.test([m.anatom_site_1, m.anatom_site_2, m.anatom_site_3].join(' '))) { skip.genital++; return false; } return true; });
const res = {}; await Promise.all(Array.from({length: 4}, async () => { while (i < ok.length) { const id = ok[i++]; res[id] = await one(id); if (i % 100 === 0) console.log(i, '/', ok.length); } }));
for (const id of ok) {
  const m = meta[id], p = res[id], d = m.diagnosis_3 || m.diagnosis_2 || m.diagnosis_1 || '';
  const befunde = ATTR.filter((_, k) => p[k]).map(([, name, col]) => ({term: name, farbe: col, ort: 'von Experten markiert'}));
  eintraege.push({id: 'isic' + id.slice(5), bild: id + '.jpg', overlay: p.some(Boolean) ? `./experten/overlay/${id}.jpg` : '', modality: 'dermoscopy',
    diagnose: DIAG[d] || d, art: [m.diagnosis_4, m.diagnosis_5].filter(Boolean).join(' – ') || (m.diagnosis_2 || ''), fitz: '', region: SITE[m.anatom_site_3] || SITE[m.anatom_site_1] || '',
    alter: m.age_approx ?? null, sex: m.sex === 'male' ? 'm' : m.sex === 'female' ? 'w' : '', datensatz: 'ISIC 2018 (Task 2)', quelle: `ISIC Archive · ${m.urheber}`, lizenz: m.lizenz,
    beschreibung: befunde.length ? 'Von Experten markierte dermatoskopische Strukturen (ISIC 2018, Task 2): ' + befunde.map(b => b.term).join(', ') + '. Die farbigen Markierungen im Bild erscheinen zusammen mit der Diagnose.' : 'Keine der fünf im ISIC-2018-Task-2 erfassten Strukturen wurde von den Experten markiert.',
    hinweis: '', befunde});
}
fs.writeFileSync(path.join(out, 'vitrine.json'), JSON.stringify({basis: './experten/bilder/', bilder: eintraege}));
console.log('Eintraege', eintraege.length, 'uebersprungen', skip, 'mit Overlay', eintraege.filter(e => e.overlay).length);
