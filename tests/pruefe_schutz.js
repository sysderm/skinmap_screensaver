"use strict";
/* Schutzfilter: keine Kinder, keine Genitalien. Prueft gegen den Atlas-Nachbau
   (Variante "schutz") mit abgeschalteter Freigabeliste, damit der Filter allein
   wirkt. Aufruf: node pruefe_schutz.js <repo-dir> <roots-dir> <python> <nachbau.py> */
const http = require("http"), fs = require("fs"), path = require("path"), {spawn} = require("child_process");
const { chromium } = require("playwright");
const [,, REPO, ROOTS, PY, NACHBAU] = process.argv;
let bestanden = 0, gescheitert = 0;
function ok(bed, text){ if(bed){ bestanden++; console.log("  ok   " + text); } else { gescheitert++; console.log("  FEHL " + text); } }
const warte = ms => new Promise(r => setTimeout(r, ms));
const sicher = i => i % 5 === 4 && i % 25 !== 24;
const PORT = 8871;

function serve(root){
  return new Promise(res => {
    const srv = http.createServer((req, r) => {
      const u = decodeURIComponent(req.url.split("?")[0]);
      const p = path.normalize(path.join(root, u === "/" ? "index.html" : u));
      if(!p.startsWith(root)){ r.writeHead(403); return r.end(); }
      fs.readFile(p, (err, data) => { if(err){ r.writeHead(404); return r.end(); }
        r.writeHead(200, {"Content-Type": p.endsWith(".html") ? "text/html; charset=utf-8" : p.endsWith(".png") ? "image/png" : "application/json"}); r.end(data); });
    });
    srv.listen(0, "127.0.0.1", () => res({srv, url: "http://127.0.0.1:" + srv.address().port}));
  });
}

(async () => {
  const kind = spawn(PY, ["-I", NACHBAU, "schutz", String(PORT)], {stdio: "ignore"});
  const browser = await chromium.launch(process.env.CHROMIUM ? {executablePath: process.env.CHROMIUM} : {});
  try{
    for(let i = 0; i < 60; i++){ try{ await new Promise((res, rej) => http.get("http://127.0.0.1:" + PORT + "/_abfragen", r => { r.resume(); res(); }).on("error", rej)); break; }catch(e){ await warte(250); } }
    const dir = path.join(ROOTS, "schutz"); fs.mkdirSync(dir, {recursive: true});
    const html = fs.readFileSync(path.join(REPO, "index.html"), "utf8")
      .replace("const OFFICE_REVIEW_REQUIRED = true;", "const OFFICE_REVIEW_REQUIRED = false;")
      .replace('const WALK_MODE = new URLSearchParams(location.search).get("mode") !== "random";', "const WALK_MODE = false;")
      .replace(/const ATLAS = "[^"]*";/, 'const ATLAS = "http://127.0.0.1:' + PORT + '";');
    ok(html.includes("const OFFICE_REVIEW_REQUIRED = false;") && html.includes("127.0.0.1:" + PORT), "Testkopie ohne Freigabeliste");
    fs.writeFileSync(path.join(dir, "index.html"), html);
    fs.mkdirSync(path.join(dir, "assets"), {recursive: true});
    if(fs.existsSync(path.join(REPO, "assets"))) for(const f of fs.readdirSync(path.join(REPO, "assets"))) fs.copyFileSync(path.join(REPO, "assets", f), path.join(dir, "assets", f));
    /* Ersatzliste mit einem Kind und einem Genitalbefund: beide muessen raus */
    fs.writeFileSync(path.join(dir, "vitrine.json"), JSON.stringify({bilder: [
      {id: "ok1", diagnose: "Psoriasis", region: "Ellenbogen", alter: 40},
      {id: "kind", diagnose: "Eczema", region: "Wange", alter: 6},
      {id: "ohne-alter", diagnose: "Tinea", region: "Arm"},
      {id: "genital", diagnose: "Lichen planus", region: "Penis", alter: 50}]}));
    const W = await serve(dir);
    const ctx = await browser.newContext({viewport: {width: 1366, height: 1024}});

    console.log("\n[1] SQL-Bedingung im Atlas");
    const T0 = Math.floor(Date.now() / 60000) * 60000 + 25000;
    for(const ansicht of ["meta", "bild"]){
      const page = await ctx.newPage();
      const fehler = []; page.on("pageerror", e => fehler.push(e.message));
      await page.route("**/fonts.googleapis.com/**", r => r.abort());
      await page.clock.install({time: T0});
      await page.goto(W.url + "/#" + ansicht); await page.clock.runFor(1500); await warte(600);
      if(ansicht === "meta"){
        ok(await page.evaluate(() => quelle) === "atlas", "Atlas aktiv");
        const zahl = await page.evaluate(async () => (await atlasSql("SELECT count(*) AS c FROM dataset WHERE " + atlas.filter))[0].c);
        const soll = [...Array(500).keys()].filter(sicher).length;
        ok(zahl === soll, "Filter laesst genau die unbedenklichen Zeilen durch: " + zahl + " (soll " + soll + ")");
        const verboten = await page.evaluate(async () => (await atlasSql("SELECT list(_row_index) AS l FROM dataset WHERE " + atlas.filter))[0].l);
        ok(verboten.every(sicher), "keine Zeile mit Kind, Genitalregion, Genitaldiagnose oder unbekanntem Alter");
      }
      const gesehen = [];
      for(let m = 0; m < 30; m++){
        await page.clock.runFor(60000); await warte(150);
        const idx = await page.evaluate(() => angezeigt && !angezeigt.eintrag.holding ? angezeigt.index : null);
        if(idx != null) gesehen.push(idx);
      }
      ok(gesehen.length >= 20, ansicht + ": " + gesehen.length + " von 30 Minuten mit Atlasbild");
      ok(gesehen.every(sicher), ansicht + ": nur unbedenkliche Zeilen gezeigt " + JSON.stringify(gesehen.filter(i => !sicher(i))));
      ok(fehler.length === 0, "keine Skriptfehler " + JSON.stringify(fehler));
      await page.close();
    }

    console.log("\n[2] Letzte Pruefung vor dem Anzeigen");
    { const page = await ctx.newPage();
      await page.route("**/fonts.googleapis.com/**", r => r.abort());
      await page.goto(W.url + "/#meta"); await warte(800);
      const f = await page.evaluate(() => [
        unbedenklich({diagnose: "Melanoma", region: "Rücken", alter: 50}),
        unbedenklich({diagnose: "Melanoma", region: "Rücken", alter: 15}),
        unbedenklich({diagnose: "Melanoma", region: "Rücken"}),
        unbedenklich({diagnose: "Melanoma", region: "Rücken", alter: 22, geschaetzt: ["alter"]}),
        unbedenklich({diagnose: "Melanoma", region: "Rücken", alter: "<18"}),
        unbedenklich({diagnose: "Genital warts", region: "", alter: 40}),
        unbedenklich({diagnose: "Psoriasis", region: "Gesäß", alter: 40}),
        unbedenklich({diagnose: "Infantile hemangioma", region: "Stirn", alter: 30}),
        unbedenklich({diagnose: "Psoriasis", region: "groin", alter: 40})]);
      ok(JSON.stringify(f) === JSON.stringify([true, false, false, false, false, false, false, false, false]), "Einzelfaelle " + JSON.stringify(f));
      await page.close(); }

    console.log("\n[3] Ersatzliste");
    { const page = await ctx.newPage();
      await page.route("**/fonts.googleapis.com/**", r => r.abort());
      await page.route("http://127.0.0.1:" + PORT + "/**", r => r.abort());
      await page.goto(W.url + "/#meta"); await warte(1200);
      const ids = await page.evaluate(() => FOLGE.map(e => e.id));
      ok(JSON.stringify(ids) === JSON.stringify(["ok1"]), "nur der Erwachsene ohne Genitalbezug bleibt: " + JSON.stringify(ids));
      const beispiele = await page.evaluate(() => BEISPIELE.filter(unbedenklich).length);
      ok(beispiele === 6, "eingebaute Beispiele alle erwachsen und unbedenklich");
      await page.close(); }
    W.srv.close();
  }finally{ await browser.close(); kind.kill(); }
  console.log("\n" + bestanden + " bestanden, " + gescheitert + " gescheitert" + (gescheitert ? "" : " -> ALLES BESTANDEN"));
  process.exit(gescheitert ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
