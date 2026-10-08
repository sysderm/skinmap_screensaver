"use strict";
/* Atlas-Pruefung der Vitrine gegen den lokalen Nachbau des Atlas-Endpunkts.
   Aufruf: node pruefe_atlas.js <repo-dir> <roots-dir> <shots-dir> <python> <nachbau.py> */
const http = require("http"), fs = require("fs"), path = require("path"), {spawn} = require("child_process");
const { chromium } = require("playwright");
const [,, REPO, ROOTS, SHOTS, PY, NACHBAU] = process.argv;
let bestanden = 0, gescheitert = 0;
function ok(bed, text){ if(bed){ bestanden++; console.log("  ok   " + text); } else { gescheitert++; console.log("  FEHL " + text); } }
const warte = ms => new Promise(r => setTimeout(r, ms));

function serve(root){
  return new Promise(res => {
    const srv = http.createServer((req, r) => {
      const u = decodeURIComponent(req.url.split("?")[0]);
      const p = path.normalize(path.join(root, u === "/" ? "index.html" : u));
      if(!p.startsWith(root)){ r.writeHead(403); return r.end(); }
      fs.readFile(p, (err, data) => {
        if(err){ r.writeHead(404); return r.end("nicht da"); }
        r.writeHead(200, {"Content-Type": p.endsWith(".html") ? "text/html; charset=utf-8" : "application/json"}); r.end(data);
      });
    });
    srv.listen(0, "127.0.0.1", () => res({srv, url: "http://127.0.0.1:" + srv.address().port}));
  });
}
async function nachbau(variante, port){
  const kind = spawn(PY, ["-I", NACHBAU, variante, String(port)], {stdio: "ignore"});
  for(let i = 0; i < 60; i++){
    try{ await new Promise((res, rej) => http.get("http://127.0.0.1:" + port + "/_abfragen", r => { r.resume(); res(); }).on("error", rej)); return kind; }
    catch(e){ await warte(250); }
  }
  throw new Error("Nachbau startet nicht: " + variante);
}
const abfragen = port => new Promise(res => http.get("http://127.0.0.1:" + port + "/_abfragen", r => { let d = ""; r.on("data", c => d += c); r.on("end", () => res(JSON.parse(d))); }));

/* Kopie der echten index.html, nur die Atlas-Adresse ersetzt */
function wurzel(name, atlasUrl, liste){
  const dir = path.join(ROOTS, name); fs.mkdirSync(dir, {recursive: true});
  const html = fs.readFileSync(path.join(REPO, "index.html"), "utf8");
  const ersetzt = html.replace(/const ATLAS = "[^"]*";/, 'const ATLAS = "' + atlasUrl + '";');
  if(ersetzt === html && atlasUrl !== "https://skinmap.ngrok.io") throw new Error("ATLAS-Zeile nicht gefunden");
  fs.writeFileSync(path.join(dir, "index.html"), ersetzt);
  if(liste) fs.writeFileSync(path.join(dir, "vitrine.json"), fs.readFileSync(path.join(REPO, "vitrine.json")));
  return dir;
}
const anzeige = (page, id) => page.evaluate(id => getComputedStyle(document.getElementById(id)).display, id);
async function oeffne(ctx, url, zeit){
  const page = await ctx.newPage();
  const fehler = [];
  page.on("pageerror", e => fehler.push("pageerror: " + e.message));
  page.on("console", m => { if(m.type() === "error" && !/Failed to load resource/.test(m.text())) fehler.push("console: " + m.text()); });
  await page.route("**/fonts.googleapis.com/**", r => r.abort());
  if(zeit != null) await page.clock.install({time: zeit});
  await page.goto(url, {waitUntil: "load"});
  return {page, fehler};
}
/* erwartete Zeile: erste ab k, die Bild und Diagnose hat (wie im Nachbau erzeugt) */
const passt = i => i % 7 !== 3;   /* Diagnose faellt auf den ICD-Text zurueck */
const diagSoll = i => i % 11 === 5 ? "ICD-Text " + i : "Befund " + i;
function erwartet(k){ for(let i = k; i < 500; i++) if(passt(i)) return i; for(let i = 0; i < 500; i++) if(passt(i)) return i; }

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({viewport: {width: 1366, height: 1024}, deviceScaleFactor: 1});
  const kinder = [];
  try{
    const ports = {struct: 8861, blob: 8862, b64: 8863, url: 8864};
    for(const [v, p] of Object.entries(ports)) kinder.push(await nachbau(v, p));

    /* feste Zeit 25 s in eine Minute hinein: weit weg vom Wechsel */
    const T0 = Math.floor(Date.now() / 60000) * 60000 + 25000;

    for(const [variante, port] of Object.entries(ports)){
      console.log("\n[A " + variante + "] Tafel und Karte aus dem Atlas");
      const W = await serve(wurzel("atlas_" + variante, "http://127.0.0.1:" + port, true));
      const t = await oeffne(ctx, W.url + "/#bild", T0), k = await oeffne(ctx, W.url + "/#meta", T0);
      await t.page.clock.runFor(1500); await k.page.clock.runFor(1500);
      await t.page.waitForSelector("#tafelHuelle img", {timeout: 8000}).catch(() => {});
      await k.page.waitForFunction(() => document.getElementById("diagnose").textContent.length > 0, null, {timeout: 8000}).catch(() => {});
      const zustand = await t.page.evaluate(() => ({quelle, ziel: atlasZiel(platz(Date.now())), index: angezeigt && angezeigt.index, n: atlas && atlas.n, typ: atlas && atlas.bildTyp}));
      ok(zustand.quelle === "atlas", "Quelle Atlas (Bildspalte " + zustand.typ + ")");
      ok(zustand.n === 500, "Zeilenzahl 500");
      const soll = erwartet(zustand.ziel);
      ok(zustand.index === soll, "Zeile = erste passende ab Ziel " + zustand.ziel + ": " + zustand.index + " (soll " + soll + ")");
      const img = await t.page.$("#tafelHuelle img");
      ok(img !== null, "<img> auf der Tafel");
      if(img){
        const src = await img.getAttribute("src"), nw = await img.evaluate(e => e.naturalWidth);
        const srcOk = variante === "url" ? src === "http://127.0.0.1:" + port + "/bild/" + soll + ".png" : src.startsWith("data:image/png;base64,iVBOR");
        ok(srcOk, "Bildquelle: " + src.slice(0, 48) + "…");
        ok(nw === 8, "Bild dekodiert (naturalWidth=" + nw + ")");
      }
      ok(await anzeige(t.page, "markeBild") === "none", "keine Beispieldaten-Marke");
      const diag = (await k.page.textContent("#diagnose")).trim();
      ok(diag === diagSoll(soll), "Karte, gleiche Zeile: " + diag);
      ok((await k.page.textContent("#unterzeile")).trim() === (soll % 11 === 5 ? "" : "ICD-Text " + soll), "ICD-Text als Unterzeile, nicht doppelt");
      const felder = await k.page.$$eval("#felder .feld dd", l => l.map(e => ({t: e.childNodes[0].textContent, m: !!e.querySelector(".schaetzung")})));
      const gerade = soll % 2 === 0, dritt = soll % 3 === 0;
      ok(felder[0].t === (gerade ? "III" : "V") && felder[0].m === !gerade, "Fitzpatrick " + JSON.stringify(felder[0]));
      ok(felder[1].t === "Rumpf" && felder[1].m, "Region aus dem Modell markiert");
      ok(felder[2].t === (dritt ? (30 + soll % 50) + " J." : "42 J.") && felder[2].m === !dritt, "Alter " + JSON.stringify(felder[2]));
      ok(felder[3].t === (gerade ? "weiblich" : "männlich") && felder[3].m === !gerade, "Geschlecht " + JSON.stringify(felder[3]));
      ok(felder[4].t === ["isic2020", "fitzpatrick17k", "scin", "passion"][soll % 4] && !felder[4].m, "Datensatz " + felder[4].t);
      const q = (await k.page.textContent("#quelle")).trim();
      ok(q === "Quelle: SkinMap-Atlas · Lizenz: —", "Quellzeile: " + q);
      const z1 = (await t.page.textContent("#fussBild")).trim().split("   ")[0], z2 = (await k.page.textContent("#nrMeta")).trim();
      ok(z1 === z2 && z1 === (soll + 1) + " / 500", "Zaehler gleich: " + z1 + " = " + z2);
      ok(t.fehler.length === 0 && k.fehler.length === 0, "keine Skriptfehler " + JSON.stringify(t.fehler.concat(k.fehler)));
      if(variante === "struct"){
        await t.page.screenshot({path: path.join(SHOTS, "atlas_tafel.png")});
        await k.page.screenshot({path: path.join(SHOTS, "atlas_karte.png")});

        console.log("\n[B] Vorladen und Wechsel zur naechsten Minute");
        const vorher = (await abfragen(port)).length;
        await k.page.clock.runFor(15000);           // jetzt 20 s vor dem Wechsel
        await warte(800);
        const nachVorlauf = (await abfragen(port)).length;
        ok(nachVorlauf > vorher, "naechste Zeile vor dem Wechsel geholt (" + (nachVorlauf - vorher) + " Abfragen)");
        await t.page.clock.runFor(36000); await k.page.clock.runFor(21000);
        await warte(600);
        const z = await k.page.evaluate(() => ({p: platz(Date.now()), ziel: atlasZiel(platz(Date.now())), index: angezeigt.index}));
        ok(z.index === erwartet(z.ziel), "nach dem Wechsel neue Zeile " + z.index);
        const zt = await t.page.evaluate(() => angezeigt.index);
        ok(zt === z.index, "Tafel ebenfalls auf " + zt);
      }
      await t.page.close(); await k.page.close(); W.srv.close();
    }

    console.log("\n[C] Atlas faellt aus und kommt zurueck");
    { const W = await serve(wurzel("atlas_stoerung", "http://127.0.0.1:8861", true));
      const {page, fehler} = await oeffne(ctx, W.url + "/#meta", T0);
      await page.clock.runFor(1500); await warte(500);
      ok(await page.evaluate(() => quelle) === "atlas", "Start mit Atlas");
      let kaputt = true;
      await page.route("http://127.0.0.1:8861/**", r => kaputt ? r.fulfill({status: 502, body: "Bad Gateway", headers: {"Access-Control-Allow-Origin": "*"}}) : r.continue());
      await page.evaluate(() => vorrat.clear());
      await page.clock.runFor(36000); await warte(600);
      let q = (await page.textContent("#quelle")).trim();
      ok(/^Atlas: HTTP 502 — Ersatz aus der Liste\.$/.test(q), "erste Stoerung: " + q);
      ok(await page.evaluate(() => quelle) === "atlas", "noch nicht umgeschaltet");
      await page.clock.runFor(60000); await warte(600);
      q = (await page.textContent("#quelle")).trim();
      ok(await page.evaluate(() => quelle) === "liste", "nach zwei Fehlschlaegen auf Liste");
      ok(/Atlas nicht erreichbar \(HTTP 502\)/.test(q), "Stoerung benannt: " + q);
      ok(await anzeige(page, "markeMeta") !== "none", "Beispieldaten-Marke sichtbar (Liste traegt beispiel: true)");
      kaputt = false;
      for(let i = 0; i < 3 && await page.evaluate(() => quelle) !== "atlas"; i++){ await page.clock.runFor(60000); await warte(600); }
      ok(await page.evaluate(() => quelle) === "atlas", "an einer geraden Minute zurueck zum Atlas");
      await page.clock.runFor(60000); await warte(600);
      q = (await page.textContent("#quelle")).trim();
      ok(q === "Quelle: SkinMap-Atlas · Lizenz: —", "Stoerung wieder weg: " + q);
      ok(fehler.length === 0, "keine Skriptfehler " + JSON.stringify(fehler));
      await page.close(); W.srv.close(); }

    console.log("\n[D] Atlas nie erreichbar");
    { const W = await serve(wurzel("atlas_tot", "http://127.0.0.1:8869", true));
      const {page, fehler} = await oeffne(ctx, W.url + "/#meta", T0);
      await page.clock.runFor(1500); await warte(500);
      ok(await page.evaluate(() => quelle) === "liste", "Liste laeuft");
      const q = (await page.textContent("#quelle")).trim();
      ok(/^Atlas nicht erreichbar \(.+\) — es läuft die Liste\.$/.test(q), "Grund sichtbar: " + q);
      ok((await page.textContent("#nrMeta")).trim().endsWith("/ 06"), "Zaehler der Liste");
      ok(fehler.length === 0, "keine Skriptfehler " + JSON.stringify(fehler));
      await page.close();
      const s = await oeffne(ctx, W.url + "/", T0); await s.page.clock.runFor(1500); await warte(400);
      ok(/Atlas nicht erreichbar/.test(await s.page.textContent("#standText")), "Einrichtungsseite nennt den Atlas-Ausfall");
      await s.page.close(); W.srv.close(); }

    console.log("\n[E] Einrichtungsseite mit Atlas");
    { const W = await serve(wurzel("atlas_setup", "http://127.0.0.1:8861", true));
      const {page} = await oeffne(ctx, W.url + "/", T0); await page.clock.runFor(1500); await warte(400);
      const st = (await page.textContent("#standText")).trim();
      ok(/antwortet: 500 Zeilen, Bilder als STRUCT\(BYTES BLOB, PATH VARCHAR\)/.test(st), "Stand: " + st.slice(0, 110) + "…");
      await page.screenshot({path: path.join(SHOTS, "atlas_setup.png")});
      await page.close(); W.srv.close(); }
  }finally{
    await browser.close();
    for(const k of kinder) k.kill();
  }
  console.log("\n" + bestanden + " bestanden, " + gescheitert + " gescheitert" + (gescheitert ? "" : " -> ALLES BESTANDEN"));
  process.exit(gescheitert ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
