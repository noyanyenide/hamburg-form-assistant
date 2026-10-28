import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { PdfAssets } from '../../src/pdf/engine';

const root = resolve(__dirname, '../..');

export function loadTestAssets(): PdfAssets {
  return {
    template: new Uint8Array(readFileSync(resolve(root, 'public/form/antrag-aufenthaltstitel-d-tr.pdf'))),
    font: new Uint8Array(readFileSync(resolve(root, 'public/fonts/NotoSans-Regular-latin.ttf'))),
  };
}
