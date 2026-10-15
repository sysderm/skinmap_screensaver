// Holt Metadaten (Diagnose, Region, Alter, Lizenz, Urheber) der ISIC-Bilder aus der oeffentlichen ISIC-Archiv-API.
// Aufruf: node scripts/isic_meta.mjs <Ordner mit ISIC_xxxxxxx.jpg> <Ausgabe.json>   (strikt nacheinander, 20 Bilder pro Anfrage)
import fs from 'fs';
const [dir, out] = process.argv.slice(2);
const ids = fs.readdirSync(dir).filter(f => /^ISIC_\d+\.jpg$/.test(f)).map(f => f.replace('.jpg',''));
const meta = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out)) : {};
const todo = ids.filter(i => !meta[i]);
for (let k = 0; k < todo.length; k += 20) {
  const part = todo.slice(k, k + 20);
  const u = new URL('https://api.isic-archive.com/api/v2/images/search/');
  u.searchParams.set('query', part.map(i => 'isic_id:' + i).join(' OR ')); u.searchParams.set('limit', '50');
  const r = await fetch(u); if (!r.ok) throw new Error('HTTP ' + r.status);
  for (const x of (await r.json()).results) meta[x.isic_id] = {lizenz: x.copyright_license, urheber: x.attribution, ...x.metadata.clinical, typ: x.metadata.acquisition?.dermoscopic_type || ''};
  fs.writeFileSync(out, JSON.stringify(meta)); console.log(Object.keys(meta).length, '/', ids.length);
  await new Promise(r => setTimeout(r, 500));
}
console.log('fertig, fehlend:', ids.filter(i => !meta[i]).length);
