"use strict";
// Optionaler, lesender Integrationstest gegen den konfigurierten echten Atlas.
// Keine Bilder oder Zeileninhalte werden gespeichert oder protokolliert.
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const root = path.resolve(__dirname, "..");
let phase = "Start";
const server = http.createServer((req, res) => {
  const name = req.url.split("?")[0];
  const file = name === "/" ? "index.html" : name === "/vitrine.json" ? "vitrine.json" : null;
  if (!file) { res.writeHead(404); return res.end(); }
  res.setHeader("Content-Type", file.endsWith("html") ? "text/html; charset=utf-8" : "application/json");
  res.end(fs.readFileSync(path.join(root, file)));
});
(async () => {
  let browser;
  try {
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    browser = await chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined});
    const context = await browser.newContext({viewport: {width: 1366, height: 1024}});
    await context.route("**/fonts.googleapis.com/**", route => route.abort());
    const errors = [];
    context.on("page", page => page.on("pageerror", () => errors.push("Browser-Laufzeitfehler")));
    context.on("requestfailed", request => {
      if (new URL(request.url()).hostname === "skinmap.ngrok.io")
        console.error("Atlas-Netzwerkfehler: " + request.failure().errorText);
    });
    const time = Math.floor(Date.now() / 60000) * 60000 + 10000;
    const pages = [];
    const local = `http://127.0.0.1:${server.address().port}/`;
    const urls = [local, process.argv[2] || local + "#bild", process.argv[3] || local + "#meta"];
    for (const [i, url] of urls.entries()) {
      const hash = ["", "#bild", "#meta"][i];
      phase = "Atlas-Verbindung " + (hash || "Einrichtung");
      const page = await context.newPage();
      await page.clock.install({time});
      await page.clock.resume();
      await page.goto(url, {waitUntil: "domcontentloaded", timeout: 15000});
      await page.waitForFunction(() => quelle === "atlas", null, {timeout: 45000});
      pages.push(page);
    }
    assert(await pages[0].evaluate(() => atlas.n > 0), "Atlas enthält Zeilen");
    phase = "Bilddekodierung";
    await pages[1].waitForFunction(() => {
      const img = document.querySelector("#tafelHuelle img");
      return angezeigt && img && img.complete && img.naturalWidth > 0;
    }, null, {timeout: 45000});
    await pages[2].waitForFunction(() => angezeigt && document.getElementById("diagnose").textContent.trim(), null, {timeout: 45000});
    phase = "Synchronisation";
    const indices = await Promise.all(pages.slice(1).map(page => page.evaluate(() => angezeigt.index)));
    assert.equal(typeof indices[0], "number");
    assert.equal(indices[0], indices[1], "Tafel und Karte zeigen dieselbe Zeile");
    assert(await pages[1].evaluate(() => angezeigt.eintrag.modality === "dermoscopy"), "Nur Dermatoskopie");
    phase = "Diagnosefreigabe nach Bildbestätigung";
    await pages[2].waitForFunction(() => getComputedStyle(document.getElementById("diagnose")).visibility === "visible", null, {timeout: 45000});
    assert.equal(errors.length, 0, "Keine Browser-Laufzeitfehler");
    console.log("Liveprüfung bestanden: Dermatoskopie, Bild dekodiert, Diagnosefreigabe und beide Schirme synchron.");
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(() => { console.error("Liveprüfung fehlgeschlagen bei: " + phase); process.exitCode = 1; });
