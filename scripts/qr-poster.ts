/**
 * Creates a QR code and a printable A4 poster (TR / DE / EN) for the public
 * address of the deployed app:
 *
 *   npm run qr -- https://example.github.io/hamburg-form-assistant/
 *
 * Output: out/qr/app-qr.png, out/qr/app-qr.svg, out/qr/poster-A4.pdf
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import QRCode from 'qrcode';

const url = process.argv[2];
if (!url || !/^https:\/\//.test(url)) {
  console.error('Usage: npm run qr -- https://your-public-address/');
  process.exit(1);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'out/qr');
mkdirSync(outDir, { recursive: true });

const DARK = '#0b2e4b';
await QRCode.toFile(resolve(outDir, 'app-qr.png'), url, { width: 1200, margin: 4, errorCorrectionLevel: 'M', color: { dark: DARK, light: '#ffffff' } });
writeFileSync(resolve(outDir, 'app-qr.svg'), await QRCode.toString(url, { type: 'svg', margin: 4, errorCorrectionLevel: 'M', color: { dark: DARK, light: '#ffffff' } }));

/* ------------------------------- A4 poster -------------------------------- */
const doc = await PDFDocument.create();
doc.registerFontkit(fontkit);
const font = await doc.embedFont(new Uint8Array(readFileSync(resolve(root, 'public/fonts/NotoSans-Regular-latin.ttf'))), { subset: false });
const page = doc.addPage([595.28, 841.89]);
const W = page.getWidth();
const brand = rgb(0.059, 0.239, 0.388);
const ink = rgb(0.06, 0.09, 0.16);
const muted = rgb(0.39, 0.45, 0.53);

const centered = (p: PDFPage, text: string, y: number, size: number, f: PDFFont, color = ink) => {
  p.drawText(text, { x: (W - f.widthOfTextAtSize(text, size)) / 2, y, size, font: f, color });
};

page.drawRectangle({ x: 0, y: 841.89 - 120, width: W, height: 120, color: brand });
centered(page, 'Oturum izni dilekçesi – adım adım doldurun', 841.89 - 50, 20, font, rgb(1, 1, 1));
centered(page, 'Antrag auf Aufenthaltstitel – Schritt für Schritt ausfüllen', 841.89 - 76, 15, font, rgb(0.84, 0.9, 0.96));
centered(page, 'Residence permit application – fill it in step by step', 841.89 - 98, 13, font, rgb(0.84, 0.9, 0.96));
centered(page, 'Hamburg  ·  Türkçe  ·  Deutsch  ·  English', 841.89 - 152, 13, font, brand);

// QR code as crisp vector squares
const qr = QRCode.create(url, { errorCorrectionLevel: 'M' });
const count = qr.modules.size;
const qrSize = 290;
const cell = qrSize / count;
const quiet = 4 * cell; // quiet zone of 4 modules, as required by the QR specification
const qrX = (W - qrSize) / 2;
const qrTop = 841.89 - 185 - quiet;
page.drawRectangle({ x: qrX - quiet, y: qrTop - qrSize - quiet, width: qrSize + 2 * quiet, height: qrSize + 2 * quiet, color: rgb(1, 1, 1), borderColor: brand, borderWidth: 2 });
for (let r = 0; r < count; r++) {
  for (let c = 0; c < count; c++) {
    if (qr.modules.get(r, c)) page.drawRectangle({ x: qrX + c * cell, y: qrTop - (r + 1) * cell, width: cell + 0.05, height: cell + 0.05, color: rgb(0.043, 0.18, 0.294) });
  }
}

let y = qrTop - qrSize - quiet - 42;
centered(page, 'Telefon kamerasıyla tarayın', y, 17, font, ink);
centered(page, 'Mit der Handykamera scannen  ·  Scan with your phone camera', (y -= 22), 12, font, muted);
centered(page, url, (y -= 30), 11, font, brand);

y -= 50;
const notes = [
  ['Ücretsiz · Hesap gerekmez · Bilgileriniz yalnızca telefonunuzda kalır.', 12, ink],
  ['Kostenlos · Kein Konto · Ihre Daten bleiben auf Ihrem Handy.', 11, muted],
  ['Free · No account · Your data stays on your phone.', 11, muted],
] as const;
for (const [text, size, color] of notes) {
  centered(page, text, y, size, font, color);
  y -= size + 9;
}

centered(page, 'Bağımsız bir doldurma yardımcısıdır – Hamburg Eyaleti’nin resmî bir hizmeti değildir. Hukuki danışmanlık değildir.', 46, 7.5, font, muted);
centered(page, 'Unabhängige Ausfüllhilfe – kein offizielles Angebot der Freien und Hansestadt Hamburg. Keine Rechtsberatung.', 35, 7.5, font, muted);

writeFileSync(resolve(outDir, 'poster-A4.pdf'), await doc.save());
console.log(`QR code and poster for ${url} written to out/qr/`);
