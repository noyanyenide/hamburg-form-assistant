/**
 * End-to-end smoke test of the built app in a mobile-sized Chromium.
 *
 *   npm run build && npx vite preview --port 4173 &
 *   node scripts/e2e-smoke.mjs [http://localhost:4173] [screenshot-dir]
 *
 * Requires the `playwright` package with Chromium (not a project dependency;
 * install it globally or run where it is available). The script fills the
 * whole wizard in Turkish, signs, generates and downloads the PDF, checks it
 * with pdf-lib, verifies that no request ever leaves the app's origin, then
 * tests resume-after-reload and "delete all my data".
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  playwright = require(join(execSync('npm root -g').toString().trim(), 'playwright'));
}
const { PDFDocument } = await import('pdf-lib');

const BASE = process.argv[2] ?? 'http://localhost:4173';
const SHOTS = process.argv[3] ?? 'out/e2e';
mkdirSync(SHOTS, { recursive: true });
const origin = new URL(BASE).origin;

const browser = await playwright.chromium.launch();
const context = await browser.newContext({
  viewport: { width: Number(process.env.E2E_WIDTH ?? 390), height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  acceptDownloads: true,
  locale: 'tr-TR',
});
const page = await context.newPage();
const problems = [];
const foreignRequests = [];
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') problems.push(`console: ${m.text()}`);
  if (process.env.E2E_VERBOSE) console.log(`[console.${m.type()}] ${m.text()}`);
});
context.on('request', (r) => {
  const url = r.url();
  if (!url.startsWith(origin) && !url.startsWith('blob:') && !url.startsWith('data:')) foreignRequests.push(url);
});

let shot = 0;
const snap = async (name) => page.screenshot({ path: join(SHOTS, `${String(++shot).padStart(2, '0')}-${name}.png`), fullPage: true });
const fill = (id, value) => page.locator(`#${id}`).fill(value);
const radio = (id, value) => page.locator(`input[name="${id}"][value="${value}"]`).check();
const next = async (name) => {
  await snap(name);
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(150);
};

await page.goto(BASE);
await page.getByRole('button', { name: 'Türkçe' }).click();
await snap('welcome');
await page.getByRole('button', { name: 'Başla' }).click();

// 1 name — first try "next" with nothing filled to see validation
await page.locator('button[type="submit"]').click();
await page.waitForTimeout(150);
await snap('validation-errors');
await fill('f-applicant-surname', 'Yılmaz');
await fill('f-applicant-birthName', 'Öztürk');
await fill('f-applicant-givenNames', 'Ayşe Gül');
await next('name');
// 2 birth
await fill('f-applicant-birthDate', '14031988');
await fill('f-applicant-birthPlace', 'İzmir');
await page.getByRole('button', { name: 'türkisch', exact: true }).first().click();
await next('birth');
// 3 address
await fill('f-applicant-street', 'Große Bergstraße');
await fill('f-applicant-houseNumber', '12a');
await fill('f-applicant-postalCode', '22767');
await fill('f-applicant-phone', '+49 40 1234567');
await next('address');
// 4 appearance
await page.locator('#f-applicant-eyeColor').selectOption('brown');
await fill('f-applicant-heightCm', '165');
await next('appearance');
// 5 passport
await fill('f-passport-number', 'U12345678');
await fill('f-passport-issuePlace', 'Ankara');
await fill('f-passport-issueDate', '02052020');
await fill('f-passport-validUntil', '01052030');
await next('passport');
// 6 entry
await fill('f-entry-entryDate', '15092021');
await radio('f-entry-hadPreviousStays', 'yes');
await fill('f-entry-previousStays-0-from', '102010');
await page.locator('#f-entry-previousStays-0-from').blur();
await fill('f-entry-previousStays-0-to', '092012');
await page.locator('#f-entry-previousStays-0-to').blur();
await fill('f-entry-previousStays-0-place', 'Köln');
await next('entry');
// 7 history
await radio('f-history-expelledOrRefused', 'no');
await next('history');
// 8 stay
await radio('f-stay-purpose', 'family');
await fill('f-stay-purposeDetails', 'Ehegattennachzug');
await page.getByLabel('Kendi işim / çalışmam').check();
await next('stay');
// 9 marital
await radio('f-marital-status', 'married');
await next('marital');
// 10 spouse
await page.getByRole('button', { name: 'Kendi soyadımı kullan' }).click();
await fill('f-spouse-givenNames', 'Mehmet Çağrı');
await fill('f-spouse-birthDate', '07111985');
await fill('f-spouse-birthPlace', 'Trabzon');
await fill('f-spouse-nationality', 'türkisch');
await next('spouse');
// 11 children
await radio('f-children-hasChildren', 'yes');
await page.getByRole('button', { name: 'Kendi soyadımı kullan' }).click();
await fill('f-children-list-0-givenNames', 'Elif');
await fill('f-children-list-0-birthDate', '21062016');
await fill('f-children-list-0-birthPlace', 'Hamburg');
await fill('f-children-list-0-nationality', 'deutsch');
await page.getByRole('button', { name: /Kendi şehrimi kullan/ }).click();
await next('children');
// 12 parents
await fill('f-parents-father-surname', 'Öztürk');
await fill('f-parents-father-givenNames', 'Hüseyin');
await fill('f-parents-father-birthDate', '1960');
await page.getByLabel('Annemin bilgilerini bilmiyorum').check();
await next('parents');
// 13 application
await radio('f-application-issueOrExtension', 'yes');
await radio('f-application-settlementPermit', 'no');
await next('application');

// review
await page.getByRole('heading', { name: 'Bilgilerinizi kontrol edin' }).waitFor();
await page.getByRole('button', { name: 'İmzaya geç' }).waitFor({ timeout: 15000 });
await snap('review');

// resume after reload: answers must be restored from IndexedDB
await page.waitForTimeout(800);
await page.reload();
await page.getByRole('button', { name: 'Dilekçeye devam et' }).click();
const restored = await page.locator('#f-application-issueOrExtension, input[name="f-application-issueOrExtension"][value="yes"]').first().isChecked();
if (!restored) problems.push('draft was not restored after reload');
await snap('resumed');
await page.locator('button[type="submit"]').click();
await page.getByRole('button', { name: 'İmzaya geç' }).click();

// signature
await page.getByLabel(/Beyanı okudum/).check();
const canvas = page.locator('canvas[role="img"]');
await canvas.scrollIntoViewIfNeeded();
const box = await canvas.boundingBox();
await page.mouse.move(box.x + 30, box.y + box.height * 0.6);
await page.mouse.down();
for (let i = 0; i <= 40; i++) {
  await page.mouse.move(box.x + 30 + i * 7, box.y + box.height * (0.6 + 0.25 * Math.sin(i / 3)));
}
await page.mouse.up();
await page.waitForTimeout(300);
await snap('signed');
await page.getByRole('button', { name: 'PDF oluştur' }).click();

// result
await page.getByRole('button', { name: 'PDF’yi indir' }).waitFor({ timeout: 30000 });
// The PDF.js preview must actually show the page (not a blank canvas).
const previewInk = async () =>
  page.evaluate(() => {
    const c = document.querySelector('canvas[aria-label]');
    if (!c || !c.width) return 0;
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let dark = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] < 128) dark++;
    return dark;
  });
const renderStart = Date.now();
await page.locator('[data-rendered="true"]').waitFor({ timeout: 30000 });
console.log(`Preview rendered in ${Date.now() - renderStart} ms`);
const ink = await previewInk();
if (ink === 0) problems.push('PDF preview stayed blank');
await snap('result');
const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'PDF’yi indir' }).click()]);
const file = join(SHOTS, download.suggestedFilename());
await download.saveAs(file);
const pdf = await PDFDocument.load(readFileSync(file));
console.log(`Downloaded ${download.suggestedFilename()}: ${pdf.getPageCount()} pages, ${readFileSync(file).length} bytes`);
if (pdf.getPageCount() !== 2) problems.push('PDF does not have 2 pages');

// share dialog shows a QR code with the app's own address (never any answers)
await page.getByRole('button', { name: 'Menü' }).click();
await page.getByRole('button', { name: 'Uygulamayı paylaş' }).click();
await page.getByRole('img', { name: /QR kod/ }).waitFor();
const sharedUrl = await page.locator('dialog[open] p.break-all').textContent();
if (sharedUrl !== new URL(BASE).href) problems.push(`share dialog shows ${sharedUrl}, expected ${new URL(BASE).href}`);
await snap('share-qr');
await page.keyboard.press('Escape');

// delete all data
await page.getByRole('button', { name: 'Menü' }).click();
await page.getByRole('button', { name: 'Tüm verilerimi sil' }).click();
await snap('delete-confirm');
await page.getByRole('button', { name: 'Evet, hepsini sil' }).click();
await page.getByRole('heading', { name: /Dilinizi seçin/ }).waitFor();
await snap('after-delete');
const stored = await page.evaluate(async () => {
  const dbs = (await indexedDB.databases?.()) ?? [];
  return { dbs: dbs.map((d) => d.name), ls: Object.keys(localStorage) };
});
if (stored.dbs.includes('hh-aufenthaltstitel-formularhilfe')) problems.push(`database still present: ${JSON.stringify(stored)}`);
if (stored.ls.some((k) => k.startsWith('hh-ae.'))) problems.push(`localStorage keys still present: ${JSON.stringify(stored)}`);

await browser.close();
console.log(`Foreign requests: ${foreignRequests.length}`);
for (const r of foreignRequests) console.log(`  ${r}`);
if (problems.length || foreignRequests.length) {
  console.error('FAILED');
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log(`OK – screenshots in ${SHOTS}`);
