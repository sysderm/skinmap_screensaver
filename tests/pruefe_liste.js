"use strict";
/* Browser-Pruefung der SkinMap-Vitrine. Aufruf: node pruefe_liste.js <repo-dir> <roots-dir> <shots-dir> */
const http = require("http"), fs = require("fs"), path = require("path");
const { chromium } = require("playwright");

const [,, REPO, ROOTS, SHOTS] = process.argv;
let bestanden = 0, gescheitert = 0;
function ok(bed, text){ if(bed){ bestanden++; console.log("  ok   " + text); } else { gescheitert++; console.log("  FEHL " + text); } }

function serve(root){
  return new Promise(res => {
    const srv = http.createServer((req, r) => {
      const u = decodeURIComponent(req.url.split("?")[0]);
      let p = path.normalize(path.join(root, u === "/" ? "index.html" : u));
      if(!p.startsWith(root)){ r.writeHead(403); return r.end(); }
      fs.readFile(p, (err, data) => {
        if(err){ r.writeHead(404); return r.end("nicht da"); }
        const typ = {".html":"text/html; charset=utf-8", ".json":"application/json", ".png":"image/png"}[path.extname(p)] || "application/octet-stream";
        r.writeHead(200, {"Content-Type": typ}); r.end(data);
      });
    });
    srv.listen(0, "127.0.0.1", () => res({srv, url: "http://127.0.0.1:" + srv.address().port}));
  });
}

async function seite(ctx, url){
  const page = await ctx.newPage();
  const fehler = [];
  page.on("pageerror", e => fehler.push("pageerror: " + e.message));
  page.on("console", m => { if(m.type() === "error" && !/fonts\.googleapis|fonts\.gstatic|Failed to load resource/.test(m.text())) fehler.push("console: " + m.text()); });
  await page.route("**/fonts.googleapis.com/**", r => r.abort());
  await page.goto(url, {waitUntil: "load"});
  await page.waitForTimeout(600);
  return {page, fehler};
}
const anzeige = (page, id) => page.evaluate(id => getComputedStyle(document.getElementById(id)).display, id);

(async () => {
  const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
  const html = fs.readFileSync(path.join(REPO, "index.html"), "utf8").replace("const DERMOSCOPY_ONLY = true;", "const DERMOSCOPY_ONLY = false;").replace("const OFFICE_REVIEW_REQUIRED = true;", "const OFFICE_REVIEW_REQUIRED = false;").replace("const WALK_MODE = new URLSearchParams(location.search).get(\"mode\") !== \"random\";", "const WALK_MODE = false;").replace(/const ATLAS = "[^"]*";/, 'const ATLAS = "";');
  if(!/const ATLAS = "";/.test(html)) throw new Error("ATLAS-Zeile fehlt");
  const basisDir = path.join(ROOTS, "liste"); fs.mkdirSync(basisDir, {recursive: true});
  fs.writeFileSync(path.join(basisDir, "index.html"), html); fs.copyFileSync(path.join(REPO, "vitrine.json"), path.join(basisDir, "vitrine.json"));

  /* Wurzeln vorbereiten */
  const leer = path.join(ROOTS, "leer"); fs.mkdirSync(leer, {recursive: true}); fs.writeFileSync(path.join(leer, "index.html"), html);
  const bildOk = path.join(ROOTS, "bild_ok"); fs.mkdirSync(path.join(bildOk, "img"), {recursive: true});
  fs.writeFileSync(path.join(bildOk, "index.html"), html); fs.writeFileSync(path.join(bildOk, "img", "ok.png"), PNG);
  const bildKaputt = path.join(ROOTS, "bild_kaputt"); fs.mkdirSync(bildKaputt, {recursive: true}); fs.writeFileSync(path.join(bildKaputt, "index.html"), html);
  const englisch = path.join(ROOTS, "englisch"); fs.mkdirSync(englisch, {recursive: true}); fs.writeFileSync(path.join(englisch, "index.html"), html);

  const A = await serve(basisDir), B = await serve(leer), C = await serve(bildOk), D = await serve(bildKaputt), E = await serve(englisch);
  fs.writeFileSync(path.join(bildOk, "vitrine.json"), JSON.stringify({basis: C.url + "/img/", bilder: [{id: "nur1", bild: "ok.png", diagnose: "Testbild", fitz: "IV", region: "Arm", alter: 30, sex: "female", datensatz: "Test", quelle: "lokal", lizenz: "CC-0"}]}));
  fs.writeFileSync(path.join(bildKaputt, "vitrine.json"), JSON.stringify({basis: D.url + "/img", bilder: [{id: "kaputt1", bild: "/fehlt.png", diagnose: "Kaputt"}]}));
  fs.writeFileSync(path.join(englisch, "vitrine.json"), JSON.stringify([{id: "en1", url: "", condition: "Vitiligo", fitzpatrick: "VI", body_region: "Hand", age: 52, sex: "M", dataset: "Fitzpatrick17k", source: "F17k", license: "CC BY-NC-SA"}]));

  const browser = await chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined});
  const ctx = await browser.newContext({viewport: {width: 1366, height: 1024}, deviceScaleFactor: 1});

  console.log("\n[1] Einrichtungsseite (kein Hash, fremder Host)");
  { const {page, fehler} = await seite(ctx, A.url + "/");
    ok(await anzeige(page, "setup") !== "none", "setup sichtbar");
    ok(await anzeige(page, "tafel") === "none", "tafel verborgen");
    ok(await anzeige(page, "karte") === "none", "karte verborgen");
    const stand = await page.textContent("#standText");
    ok(/6 Einträge in \.\/vitrine\.json/.test(stand), "Stand nennt 6 Eintraege: " + stand.trim());
    ok(/Beispieldaten gekennzeichnet/.test(stand), "Stand nennt beispiel-Flagge");
    ok(await page.title() === "SkinMap Vitrine", "Titel");
    ok(fehler.length === 0, "keine Skriptfehler " + JSON.stringify(fehler));
    await page.screenshot({path: path.join(SHOTS, "setup.png")});
    await page.close(); }

  console.log("\n[2] Tafel (#bild) mit Beispieldaten-Liste");
  { const {page, fehler} = await seite(ctx, A.url + "/#bild");
    ok(await anzeige(page, "tafel") !== "none", "tafel sichtbar");
    ok(await anzeige(page, "setup") === "none", "setup verborgen");
    ok(await anzeige(page, "karte") === "none", "karte verborgen");
    ok(await page.$("#tafelHuelle canvas") !== null, "Platzhalter-Leinwand gezeichnet (kein Bild in Liste)");
    ok(await anzeige(page, "markeBild") !== "none", "Marke Beispieldaten sichtbar (beispiel: true)");
    const fuss = await page.textContent("#fussBild");
    ok(/^0[1-6] \/ 06\s+·\s+nächstes in \d\d s$/.test(fuss.trim()), "Fusszeile: " + fuss.trim());
    const breite = await page.$eval("#laufBild", e => e.style.width);
    ok(/^\d+(\.\d+)?%$/.test(breite), "Laufbalken gesetzt: " + breite);
    ok(fehler.length === 0, "keine Skriptfehler " + JSON.stringify(fehler));
    await page.screenshot({path: path.join(SHOTS, "tafel.png")});
    await page.close(); }

  console.log("\n[3] Karte (#meta) mit Beispieldaten-Liste");
  { const {page, fehler} = await seite(ctx, A.url + "/#meta");
    ok(await anzeige(page, "karte") !== "none", "karte sichtbar");
    ok(await anzeige(page, "tafel") === "none", "tafel verborgen");
    const diag = (await page.textContent("#diagnose")).trim();
    ok(diag.length > 0, "Diagnose gesetzt: " + diag);
    ok(await page.$$eval("#felder .feld", l => l.length) === 5, "fuenf Felder");
    const q = await page.textContent("#quelle");
    ok(/^Quelle: .+ · Lizenz: .+$/.test(q.trim()), "Quelle/Lizenz: " + q.trim());
    ok(!(await page.$eval("#quelle", e => e.classList.contains("stoerung"))), "keine Stoerung");
    ok(await anzeige(page, "markeMeta") !== "none", "Marke Beispieldaten sichtbar");
    ok(fehler.length === 0, "keine Skriptfehler " + JSON.stringify(fehler));
    await page.screenshot({path: path.join(SHOTS, "karte.png")});
    await page.close(); }

  console.log("\n[4] Gleichlauf: Tafel und Karte zeigen denselben Eintrag");
  { const p1 = await seite(ctx, A.url + "/#bild"), p2 = await seite(ctx, A.url + "/#meta");
    const lese = p => p.evaluate(() => ({platz: platz(Date.now()), rest: restMs(Date.now()), ids: FOLGE.map(e => e.id), aktuell: eintragFuer(Date.now()).eintrag.id, index: eintragFuer(Date.now()).index}));
    let a = await lese(p1.page), b = await lese(p2.page);
    if(a.rest < 1500 || b.rest < 1500){ await p1.page.waitForTimeout(2000); a = await lese(p1.page); b = await lese(p2.page); }
    ok(JSON.stringify(a.ids) === JSON.stringify(b.ids), "gleiche Mischung: " + a.ids.join(","));
    ok(a.aktuell === b.aktuell && a.index === b.index, "gleicher Eintrag jetzt: " + a.aktuell + " (Index " + a.index + ")");
    const n1 = (await p1.page.textContent("#fussBild")).trim().slice(0, 7), n2 = (await p2.page.textContent("#nrMeta")).trim();
    ok(n1 === n2, "Zaehler stimmt ueberein: " + n1 + " = " + n2);
    const erwartet = ((a.platz % a.ids.length) + a.ids.length) % a.ids.length;
    ok(a.index === erwartet, "Index = Minute mod Anzahl (" + a.platz + " mod " + a.ids.length + " = " + erwartet + ")");
    await p1.page.close(); await p2.page.close(); }

  console.log("\n[5] Hash-Wechsel ohne Neuladen");
  { const {page, fehler} = await seite(ctx, A.url + "/#bild");
    await page.evaluate(() => { location.hash = "#meta"; });
    await page.waitForTimeout(700);
    ok(await anzeige(page, "karte") !== "none" && await anzeige(page, "tafel") === "none", "nach #meta: Karte sichtbar, Tafel weg");
    ok(fehler.length === 0, "keine Skriptfehler " + JSON.stringify(fehler));
    await page.close(); }

  console.log("\n[6] Rueckfall: keine vitrine.json (404)");
  { const {page, fehler} = await seite(ctx, B.url + "/#meta");
    const q = (await page.textContent("#quelle")).trim();
    ok(/Liste nicht erreichbar \(HTTP 404\)/.test(q), "Stoerung im Klartext: " + q);
    ok(await page.$eval("#quelle", e => e.classList.contains("stoerung")), "Stoerung rot markiert");
    ok(await anzeige(page, "markeMeta") !== "none", "Marke Beispieldaten sichtbar");
    ok(await page.evaluate(() => FOLGE.length) === 6, "eingebaute 6 Beispiele laufen");
    ok(fehler.length === 0, "keine Skriptfehler " + JSON.stringify(fehler));
    await page.close();
    const s = await seite(ctx, B.url + "/");
    const stand = await s.page.textContent("#standText");
    ok(/Keine Liste unter/.test(stand), "Einrichtungsseite nennt fehlende Liste");
    await s.page.close(); }

  console.log("\n[7] Echtes Bild ueber basis + Dateiname, ohne beispiel-Flagge");
  { const {page, fehler} = await seite(ctx, C.url + "/#bild");
    await page.waitForSelector("#tafelHuelle img", {timeout: 5000}).catch(() => {});
    const img = await page.$("#tafelHuelle img");
    ok(img !== null, "<img> statt Leinwand");
    if(img){
      const src = await img.getAttribute("src"), nw = await img.evaluate(e => e.naturalWidth);
      ok(src === C.url + "/img/ok.png", "basis + Dateiname zusammengesetzt: " + src);
      ok(nw === 1, "Bild dekodiert (naturalWidth=" + nw + ")");
      ok(await img.getAttribute("alt") === "Dermatoskopische Aufnahme", "alt verrät Diagnose nicht");
    }
    ok(await anzeige(page, "markeBild") === "none", "Marke verborgen (keine beispiel-Flagge)");
    ok(fehler.length === 0, "keine Skriptfehler " + JSON.stringify(fehler));
    await page.close();
    const k = await seite(ctx, C.url + "/#meta");
    const felder = await k.page.$$eval("#felder dd", l => l.map(e => e.textContent));
    ok(felder[3] === "Weiblich", "sex 'female' -> weiblich: " + JSON.stringify(felder));
    ok(felder[2] === "30 J.", "Alter formatiert");
    ok((await k.page.textContent("#nrMeta")).trim() === "01 / 01", "Zaehler 01 / 01");
    await k.page.close(); }

  console.log("\n[8] Kaputter Bildverweis -> Platzhalter statt Bruchbild");
  { const {page, fehler} = await seite(ctx, D.url + "/#bild");
    await page.waitForTimeout(800);
    ok(await page.$("#tafelHuelle img") === null, "kein <img> im Baum");
    ok(await page.$("#tafelHuelle canvas") !== null, "Leinwand gezeichnet");
    const bild = await page.evaluate(() => FOLGE[0].bild);
    ok(bild === D.url + "/img/fehlt.png", "Schraegstriche bereinigt: " + bild);
    ok(fehler.length === 0, "keine Skriptfehler " + JSON.stringify(fehler));
    await page.close(); }

  console.log("\n[9] Englische Feldnamen, blanke Liste");
  { const {page, fehler} = await seite(ctx, E.url + "/#meta");
    ok((await page.textContent("#diagnose")).trim() === "Vitiligo", "condition -> Diagnose");
    const felder = await page.$$eval("#felder dd", l => l.map(e => e.textContent));
    ok(JSON.stringify(felder) === JSON.stringify(["VI", "Hand", "52 J.", "Männlich", "Fitzpatrick17k"]), "fitzpatrick/body_region/age/sex/dataset: " + JSON.stringify(felder));
    ok(/Quelle: F17k · Lizenz: CC BY-NC-SA/.test(await page.textContent("#quelle")), "source/license");
    ok(await anzeige(page, "markeMeta") === "none", "blanke Liste: keine Marke");
    ok(fehler.length === 0, "keine Skriptfehler " + JSON.stringify(fehler));
    await page.close(); }

  console.log("\n[10] Hostname-Erkennung (sm1/sm2) ohne Hash");
  { const page = await ctx.newPage();
    await page.route("**/fonts.googleapis.com/**", r => r.abort());
    await page.route("http://sm1.navarini.com/**", r => { const u = new URL(r.request().url()); r.continue({url: A.url + u.pathname + u.search}); });
    await page.route("http://sm2.navarini.com/**", r => { const u = new URL(r.request().url()); r.continue({url: A.url + u.pathname + u.search}); });
    await page.goto("http://sm1.navarini.com/", {waitUntil: "load"}); await page.waitForTimeout(500);
    ok(await anzeige(page, "tafel") !== "none" && await anzeige(page, "setup") === "none", "sm1 -> Tafel");
    await page.goto("http://sm2.navarini.com/", {waitUntil: "load"}); await page.waitForTimeout(500);
    ok(await anzeige(page, "karte") !== "none" && await anzeige(page, "setup") === "none", "sm2 -> Karte");
    await page.close(); }

  await browser.close();
  for(const s of [A, B, C, D, E]) s.srv.close();
  console.log("\n" + bestanden + " bestanden, " + gescheitert + " gescheitert" + (gescheitert ? "" : " -> ALLES BESTANDEN"));
  process.exit(gescheitert ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
