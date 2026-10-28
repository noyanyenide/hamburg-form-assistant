/**
 * Fills the real template with sample data (tests/helpers/sample.ts) and writes
 * out/sample-filled.pdf, for visual inspection of positions:  npm run sample:pdf
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generatePdf } from '../src/pdf/engine';
import { fakeSignaturePng } from '../tests/helpers/png';
import { sampleValues } from '../tests/helpers/sample';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const template = new Uint8Array(readFileSync(resolve(root, 'public/form/antrag-aufenthaltstitel-d-tr.pdf')));
const font = new Uint8Array(readFileSync(resolve(root, 'public/fonts/NotoSans-Regular-latin.ttf')));

const result = await generatePdf({ template, font }, sampleValues(), { signaturePng: fakeSignaturePng() });
if (result.problems.length) {
  console.error('Problems:', result.problems);
  process.exit(1);
}
mkdirSync(resolve(root, 'out'), { recursive: true });
writeFileSync(resolve(root, 'out/sample-filled.pdf'), result.bytes);
console.log(`Wrote out/sample-filled.pdf (${result.bytes.length} bytes)`);
