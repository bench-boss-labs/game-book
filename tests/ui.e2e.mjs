// Browser tests for the shared screens, run against demo/index.html in Chromium: npm run test:ui
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, extname } from 'node:path';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');
const root = fileURLToPath(new URL('..', import.meta.url));
const fixture = join(root, 'tests/fixtures/u10-sheet-items.json');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
let server, browser, base;

before(async () => {
  server = createServer(async (req, res) => {
    try {
      const path = join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
      if (!path.startsWith(root)) throw new Error('outside');
      res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' }).end(await readFile(path));
    } catch { res.writeHead(404).end(); }
  }).listen(0);
  base = `http://localhost:${server.address().port}/demo/index.html`;
  browser = await chromium.launch();
});
after(async () => { await browser?.close(); server?.close(); });

async function open(view) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(base);
  await page.waitForSelector('.gbk-summary');
  if (view) await page.click(`[data-view=${view}]`);
  page.errors = errors;
  return page;
}
const goalRow = (page, text) => page.locator('.gbk-summary tbody tr', { hasText: text });

test('coaches summary: the sheet, the mark that differs, a correction', async () => {
  const page = await open();
  const strip = await page.locator('.gbk-strip').innerText();
  assert.match(strip, /Official game sheet/);
  assert.match(strip, /U10BE38/);
  assert.match(strip, /1 correction/);
  assert.match(strip, /1 mark differs/);
  assert.equal(await page.locator('.gbk-summary .gbk-big').innerText().then((t) => t.replace(/\s/g, '')), '11–2');
  assert.match(await goalRow(page, '02:49').innerText(), /Mark: #23 · A #18/);
  assert.match(await goalRow(page, '07:12').innerText(), /Corrected[\s\S]*by Cristian/);
  assert.match(await page.locator('aside').innerText(), /#2 C\. Keen\s+5 G · 2 A · 2 PIM/);
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('correct a goal, see it in History, undo it', async () => {
  const page = await open();
  await goalRow(page, '02:49').getByRole('button', { name: 'Correct' }).click();
  const dlg = page.locator('dialog.gbk-dialog');
  await dlg.getByText('Your mark on the video').waitFor();
  await dlg.getByRole('button', { name: 'Use my mark' }).click();
  assert.equal(await dlg.getByRole('button', { name: '#18 J. Park' }).nth(1).getAttribute('aria-pressed'), 'true');
  await dlg.getByPlaceholder('e.g. Watched').fill('Park made the pass');
  await dlg.getByRole('button', { name: 'Save correction' }).click();
  await dlg.waitFor({ state: 'detached' });
  assert.match(await goalRow(page, '02:49').innerText(), /#18 J\. Park[\s\S]*Corrected/);
  assert.match(await page.locator('.gbk-strip').innerText(), /2 corrections/);
  assert.match(await page.locator('#log').innerText(), /Saved \(correction\)/);

  await page.getByRole('button', { name: /History/ }).click();
  const hist = page.locator('.gbk-card', { hasText: 'Corrections in effect' });
  assert.match(await hist.innerText(), /Park made the pass/);
  await hist.locator('.gbk-row', { hasText: 'Park made the pass' }).getByRole('button', { name: 'Undo' }).click();
  assert.match(await page.locator('.gbk-strip').innerText(), /1 correction\b/);
  assert.match(await goalRow(page, '02:49').innerText(), /Official/);
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('add a goal on a marks-only game, then remove it', async () => {
  const page = await open('summary-tracked');
  assert.match(await page.locator('.gbk-strip').innerText(), /Coaches’ marks/);
  await page.getByRole('button', { name: '+ Add a goal' }).click();
  const dlg = page.locator('dialog.gbk-dialog');
  await dlg.locator('select').selectOption('2');
  await dlg.getByPlaceholder('mm:ss').fill('9:99x');
  await dlg.getByRole('button', { name: '#97 R. Costa' }).first().click();
  await dlg.getByRole('button', { name: 'Add goal' }).click();
  assert.match(await dlg.getByRole('alert').innerText(), /08:41/);
  await dlg.getByPlaceholder('mm:ss').fill('05:10');
  await dlg.getByRole('button', { name: 'Add goal' }).click();
  await dlg.waitFor({ state: 'detached' });
  assert.equal((await page.locator('.gbk-summary .gbk-big').innerText()).replace(/\s/g, ''), '5–2');
  const row = goalRow(page, '05:10');
  assert.match(await row.innerText(), /Added/);
  await row.getByRole('button', { name: 'Correct' }).click();
  await dlg.getByRole('button', { name: 'Remove this goal' }).click();
  await dlg.waitFor({ state: 'detached' });
  assert.equal((await page.locator('.gbk-summary .gbk-big').innerText()).replace(/\s/g, ''), '4–2');
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('re-import the game sheet: compare, use a mark, save once', async () => {
  const page = await open();
  await page.getByRole('button', { name: 'Replace game sheet' }).click();
  const dlg = page.locator('dialog.gbk-dialog');
  const chooser = page.waitForEvent('filechooser');
  await dlg.getByRole('button', { name: 'Pick the PDF' }).click();
  await (await chooser).setFiles(fixture);
  await dlg.getByText('3 · Compared').waitFor();
  const text = await dlg.innerText();
  assert.match(text, /Burlington Bulldogs Blue 11–2/);
  assert.match(text, /already has a game sheet/);
  assert.equal(await dlg.locator('select').isDisabled(), true);
  await dlg.getByRole('button', { name: 'Use the mark (correction)' }).click();
  await dlg.getByRole('button', { name: 'Save to Game Book' }).click();
  await dlg.waitFor({ state: 'detached' });
  assert.match(await goalRow(page, '02:49').innerText(), /#18 J\. Park[\s\S]*Corrected/);
  assert.match(await page.locator('#log').innerText(), /Saved \(game sheet\)/);
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('family summary and family stats lead with the kid', async () => {
  const page = await open('summary-family');
  const strip = await page.locator('.gbk-strip').innerText();
  assert.doesNotMatch(strip, /mark differs/, 'no coach-only notes for families');
  assert.match(await page.locator('.gbk-kidcard').innerText(), /Sam this game[\s\S]*Assists\s+1/);
  assert.equal(await page.locator('tr.gbk-kid').count(), 1);
  assert.equal(await page.locator('.gbk-summary').getByText(/Mark:/).count(), 0);

  await page.click('[data-view=stats-family]');
  const card = await page.locator('.gbk-kidcard').innerText();
  assert.match(card, /Tied 2nd on the team in points/);
  assert.match(card, /Points\s+4/);
  await page.getByRole('button', { name: '▶ 2 goals' }).click();
  assert.match(await page.locator('#log').innerText(), /Would play 2 goals/);
  assert.match(await page.locator('tr.gbk-kid').innerText(), /#7 Sam/);
  await page.getByRole('button', { name: 'Tournament' }).click();
  assert.match(await page.locator('.gbk-stats').innerText(), /No games with goal details yet/);
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('coaches season stats and the game-row chips', async () => {
  const page = await open('stats-full');
  const t = await page.locator('.gbk-stats').innerText();
  assert.match(t, /1 from game sheets · 1 from coaches’ marks · 0 score only/);
  assert.match(t, /2–0–0/);
  assert.match(t, /15 \/ 4/);
  assert.match(await page.locator('tbody tr', { hasText: 'C. Keen' }).first().innerText(), /2\s+5\s+3\s+8/);
  await page.click('[data-view=rows]');
  const rows = await page.locator('#app').innerText();
  assert.match(rows, /Official\s+1 correction · 1 mark differs/);
  assert.match(rows, /Coaches’ marks/);
  assert.match(rows, /Sam: 0 G · 1 A/);
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('narrow phone width: no sideways page scroll', async () => {
  const page = await open();
  await page.setViewportSize({ width: 390, height: 800 });
  for (const v of ['summary-full', 'summary-family', 'stats-full', 'stats-family']) {
    await page.click(`[data-view=${v}]`);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(over <= 1, `${v} scrolls sideways by ${over}px`);
  }
  await page.close();
});
