import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

export interface TextItem {
  str: string;
  x: number;
  y: number;
  page: number;
}

/** Extracts positioned text with PDF.js (the same engine used for the in-app preview). */
export async function extractText(bytes: Uint8Array): Promise<TextItem[]> {
  const task = pdfjs.getDocument({ data: bytes.slice(), useSystemFonts: false });
  const doc = await task.promise;
  const items: TextItem[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue;
      items.push({ str: item.str, x: item.transform[4], y: item.transform[5], page: p });
    }
  }
  await task.destroy();
  return items;
}
