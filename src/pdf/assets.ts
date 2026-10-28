import type { PdfAssets } from './engine';

/** The official blank form, byte-identical to the file published by the authority. */
export const TEMPLATE_URL = `${import.meta.env.BASE_URL}form/antrag-aufenthaltstitel-d-tr.pdf`;
export const TEMPLATE_SHA256 = '5b44dabfafa78500eb1dfbbe5cfc0284c397a0464e1aaeffb7a1bae60cf713af';
export const FONT_URL = `${import.meta.env.BASE_URL}fonts/NotoSans-Regular-latin.ttf`;

export class TemplateIntegrityError extends Error {
  constructor() {
    super('The blank form template does not match the expected checksum.');
    this.name = 'TemplateIntegrityError';
  }
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  // Same-origin static files (precached by the service worker for offline use).
  const response = await fetch(url, { credentials: 'omit' });
  if (!response.ok) throw new Error(`Could not load ${url} (${response.status})`);
  return new Uint8Array(await response.arrayBuffer());
}

export async function sha256Hex(bytes: Uint8Array): Promise<string | null> {
  if (!globalThis.crypto?.subtle) return null; // only available in secure contexts
  const digest = await crypto.subtle.digest('SHA-256', bytes.slice().buffer as ArrayBuffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

let cached: Promise<PdfAssets> | null = null;

/** Loads (once) the blank template and the font, verifying the template's checksum. */
export function loadPdfAssets(): Promise<PdfAssets> {
  if (!cached) {
    cached = (async () => {
      const [template, font] = await Promise.all([fetchBytes(TEMPLATE_URL), fetchBytes(FONT_URL)]);
      const hash = await sha256Hex(template);
      if (hash !== null && hash !== TEMPLATE_SHA256) throw new TemplateIntegrityError();
      return { template, font };
    })().catch((error: unknown) => {
      cached = null;
      throw error;
    });
  }
  return cached;
}
