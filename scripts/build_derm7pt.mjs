// Baut derm7pt/ (unveraenderte Originalbilder + vitrine.json) aus dem Derm7pt-Archiv release_v0.
// Aufruf: node scripts/build_derm7pt.mjs <entpackter Ordner release_v0>
// ACHTUNG: Derm7pt darf nicht weiterverteilt werden (CC BY-NC-ND, nur Forschung). Der Ordner derm7pt/ ist in .gitignore
// und gehoert NICHT auf oeffentliche Hosts, nur auf den geschuetzten (Login-)Host.
import fs from 'fs'; import path from 'path';
const src = process.argv[2];
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const out = path.join(root, 'derm7pt', 'bilder'); fs.mkdirSync(out, {recursive: true});
const t = fs.readFileSync(path.join(src, 'meta', 'meta.csv'), 'utf8').replace(/^\uFEFF/, '').trim().split(/\r?\n/); const h = t[0].split(',');
const rows = t.slice(1).map(l => Object.fromEntries(l.split(',').map((v, i) => [h[i], v])));
const DIAG = {'basal cell carcinoma': 'Basalzellkarzinom', 'blue nevus': 'Blauer Nävus', 'clark nevus': 'Clark-Nävus (dysplastisch)', 'combined nevus': 'Kombinierter Nävus', 'congenital nevus': 'Kongenitaler Nävus', 'dermal nevus': 'Dermaler Nävus', 'dermatofibroma': 'Dermatofibrom', 'lentigo': 'Lentigo',
  'melanoma (in situ)': 'Melanoma in situ', 'melanoma (less than 0.76 mm)': 'Melanom (< 0,76 mm)', 'melanoma (0.76 to 1.5 mm)': 'Melanom (0,76–1,5 mm)', 'melanoma (more than 1.5 mm)': 'Melanom (> 1,5 mm)', 'melanoma metastasis': 'Melanom-Metastase', 'melanoma': 'Melanom',
  'melanosis': 'Melanose', 'miscellaneous': 'Sonstige', 'recurrent nevus': 'Rezidivierender Nävus', 'reed or spitz nevus': 'Spitz-/Reed-Nävus', 'seborrheic keratosis': 'Seborrhoische Keratose', 'vascular lesion': 'Vaskuläre Läsion'};
const REGION = {'abdomen': 'Bauch', 'head neck': 'Kopf/Hals', 'lower limbs': 'Untere Extremität', 'upper limbs': 'Obere Extremität', 'back': 'Rücken', 'chest': 'Brust', 'acral': 'Akral', 'buttocks': 'Gesäß'};
const KRIT = [
  ['pigment_network', 'Pigmentnetz', {typical: 'typisch', atypical: 'atypisch'}],
  ['streaks', 'Streaks', {regular: 'regulär', irregular: 'irregulär'}],
  ['pigmentation', 'Pigmentierung', {'diffuse irregular': 'diffus irregulär', 'localized irregular': 'lokalisiert irregulär', 'diffuse regular': 'diffus regulär', 'localized regular': 'lokalisiert regulär'}],
  ['regression_structures', 'Regressionsstrukturen', {'blue areas': 'blaue Areale', 'white areas': 'weiße Areale', combinations: 'Kombination'}],
  ['dots_and_globules', 'Dots/Globules', {regular: 'regulär', irregular: 'irregulär'}],
  ['blue_whitish_veil', 'Blau-weißer Schleier', {present: 'vorhanden'}],
  ['vascular_structures', 'Gefäßstrukturen', {arborizing: 'arborisierend', 'within regression': 'innerhalb von Regression', hairpin: 'Haarnadel', dotted: 'punktförmig', comma: 'kommaförmig', 'linear irregular': 'linear irregulär', wreath: 'kranzförmig'}]];
const eintraege = []; let skip = {genital: 0, ohneBild: 0};
for (const r of rows) {
  if (/genital/i.test(r.location)) { skip.genital++; continue; }
  const f = path.join(src, 'images', r.derm); if (!r.derm || !fs.existsSync(f)) { skip.ohneBild++; continue; }
  const name = `case${r.case_num}.jpg`; fs.copyFileSync(f, path.join(out, name));   // unveraendert (CC BY-NC-ND)
  const befunde = KRIT.filter(([k]) => r[k] && r[k] !== 'absent').map(([k, term, map]) => ({term, ort: map[r[k]] || r[k], farbe: ''}));
  eintraege.push({id: 'd7p' + r.case_num, bild: name, overlay: '', modality: 'dermoscopy', diagnose: DIAG[r.diagnosis] || r.diagnosis, art: '', fitz: '', region: REGION[r.location] || r.location, alter: null, sex: r.sex === 'male' ? 'm' : r.sex === 'female' ? 'w' : '',
    datensatz: 'Derm7pt', quelle: 'Derm7pt – Kawahara et al., IEEE JBHI 2019', lizenz: 'CC BY-NC-ND 4.0 · nur Forschung', hinweis: '',
    beschreibung: `7-Punkte-Checkliste (Expertenangaben, Score ${r.seven_point_score}): ` + (befunde.length ? befunde.map(b => `${b.term} ${b.ort}`).join('; ') : 'keines der sieben Kriterien vorhanden') + '.', befunde});
}
fs.writeFileSync(path.join(root, 'derm7pt', 'vitrine.json'), JSON.stringify({basis: './derm7pt/bilder/', bilder: eintraege}));
console.log('Eintraege', eintraege.length, 'uebersprungen', skip);
