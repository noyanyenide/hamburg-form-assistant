/**
 * Characters that the embedded PDF font (Noto Sans, Latin subset) can render.
 * Keep in sync with UNICODES in scripts/subset-font.sh.
 *
 * Covers German (ä ö ü ß …), Turkish (ç ğ ı İ ö ş ü …) and other Latin-script
 * languages as written in passports. Non-Latin scripts are rejected by
 * validation instead of silently producing missing glyphs in the PDF.
 */
const ALLOWED_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x0020, 0x007e],
  [0x00a0, 0x024f],
  [0x0259, 0x0259],
  [0x02bb, 0x02bc],
  [0x02c6, 0x02c6],
  [0x02da, 0x02da],
  [0x02dc, 0x02dc],
  [0x1e00, 0x1eff],
  [0x2010, 0x2015],
  [0x2018, 0x201e],
  [0x2020, 0x2022],
  [0x2026, 0x2026],
  [0x2030, 0x2030],
  [0x2039, 0x203a],
  [0x20ac, 0x20ac],
  [0x2116, 0x2116],
  [0x2122, 0x2122],
];

export function isSupportedChar(char: string): boolean {
  const cp = char.codePointAt(0);
  if (cp === undefined) return false;
  return ALLOWED_RANGES.some(([lo, hi]) => cp >= lo && cp <= hi);
}

export function unsupportedChars(text: string): string[] {
  const bad = new Set<string>();
  for (const ch of text) if (!isSupportedChar(ch)) bad.add(ch);
  return [...bad];
}

/** NFC-normalise, turn tabs/newlines into spaces and collapse repeated whitespace. */
export function normalizeText(text: string): string {
  return text.normalize('NFC').replace(/\s+/g, ' ').trim();
}
