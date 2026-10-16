"use strict";
// Read-only live verification; never retain clinical images or row contents.
const {chromium} = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined});
  try {
    const page = await browser.newPage({viewport:{width:1366,height:1024}});
    const errors = [];
    page.on('pageerror', () => errors.push('Browser runtime error'));
    await page.route('**/fonts.googleapis.com/**', route => route.abort());
    const time = Math.floor(Date.now()/60000)*60000+1000;
    await page.clock.install({time});
    await page.clock.pauseAt(time+1000);
    await page.goto(process.argv[2] || 'https://dermatoskopie.ch/', {waitUntil:'domcontentloaded'});
    await page.waitForFunction(() => quelle === 'atlas' && angezeigt && !angezeigt.eintrag.holding &&
      document.querySelector('#tafelHuelle img')?.naturalWidth > 0, null, {timeout:60000});
    assert(await page.evaluate(() => meineAnsicht === 'combined' &&
      angezeigt.eintrag.modality === 'dermoscopy' && konkreteDiagnose(angezeigt.eintrag.diagnose)));
    assert(await page.evaluate(() => {
      const caption = document.getElementById('imageDataset');
      const dataset = angezeigt.eintrag.datensatz.trim();
      return dataset ? !caption.hidden && caption.textContent.startsWith('Dataset: ') : caption.hidden;
    }));
    const ids = await page.evaluate(async () => {
      const rows = await atlasSql("SELECT id FROM (VALUES " +
        "(1, 'benign', NULL), (2, ' MALIGNANT ', 'unknown'), " +
        "(3, NULL, NULL), (4, '', '   '), (5, 'benign', 'Melanocytic naevus'), " +
        "(6, 'Malignant melanoma', NULL), (7, 'benign lichenoid keratosis', NULL), " +
        "(8, chr(9) || 'benign' || chr(10), NULL), (9, NULL, 'Basal cell carcinoma')" +
        ") AS dataset(id, condition, icd_description) WHERE " +
        diagnoseBedingung({condition:1,icd_description:1}) + " ORDER BY id");
      return rows.map(r => r.id);
    });
    assert.deepEqual(ids, [5,6,7,9]);
    assert.equal(await page.locator('#felder .feld').count(), 3);
    const hidden = () => page.locator('#diagnose').evaluate(e => getComputedStyle(e).visibility === 'hidden');
    assert(await hidden());
    const reveal = await page.evaluate(() => trainingRevealAt);
    assert(Number.isFinite(reveal));
    await page.clock.setSystemTime(reveal);
    await page.evaluate(() => tick());
    assert(!(await hidden()));
    await page.evaluate(() => fuellKarte({diagnose:'Test diagnosis',fitz:'III',region:'Back',alter:40,
      geschaetzt:['fitz','region','alter']},0,1));
    assert.equal(await page.locator('#felder .feld').nth(0).locator('.schaetzung').count(), 0);
    assert.equal(await page.locator('#felder .feld').nth(1).locator('.schaetzung').count(), 1);
    assert.equal(await page.locator('#felder .feld').nth(2).locator('.schaetzung').count(), 1);
    await page.evaluate(() => bildDatensatz({datensatz:'isic2020'}));
    assert.equal(await page.locator('#imageDataset').textContent(), 'Dataset: ISIC 2020');
    for(const viewport of [{width:1366,height:1024},{width:1024,height:768},{width:768,height:1024}]){
      await page.setViewportSize(viewport);
      assert(await page.evaluate(() => {
        const image = document.getElementById('tafelHuelle').getBoundingClientRect();
        const caption = document.getElementById('imageDataset').getBoundingClientRect();
        return image.bottom <= caption.top && caption.bottom <= innerHeight && caption.width > 0;
      }));
    }
    await page.evaluate(() => bildDatensatz(null));
    assert(await page.locator('#imageDataset').isHidden());
    assert.equal(errors.length, 0);
    console.log('Public live check passed: combined view, decoded dermoscopy image, specific diagnosis, 15s reveal, 3 metadata fields, synthetic DuckDB filter cases, skin type without model label, dataset caption and landscape/portrait fit.');
  } finally { await browser.close(); }
})().catch(() => {console.error('Public live check failed; no clinical contents logged.');process.exitCode=1;});
