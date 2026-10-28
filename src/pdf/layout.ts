import type { TextStyle } from './fieldMap';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type Measure = (text: string, fontSize: number) => number;

export interface PlacedLine {
  text: string;
  x: number;
  /** Baseline, PDF user space (origin bottom-left). */
  y: number;
}

export type LayoutResult =
  | { ok: true; fontSize: number; lines: PlacedLine[] }
  | { ok: false; reason: 'overflow' };

/** Noto Sans: capHeight 714 / unitsPerEm 1000. */
export const CAP_HEIGHT = 0.714;
const LINE_SPACING = 1.12;
const PAD_X = 3;
const PAD_Y = 1;
/** Baseline offset above the bottom of an "underline" field's widget rect. */
const UNDERLINE_BASELINE = 2.5;
/** Below this size a second line is preferred over shrinking further. */
const PREFER_WRAP_BELOW = 7;
const STEP = 0.25;

function sizes(from: number, to: number): number[] {
  const out: number[] = [];
  for (let s = from; s >= to - 1e-9; s -= STEP) out.push(Math.round(s * 100) / 100);
  return out;
}

/** Greedy word wrap; words longer than a line are broken between characters. */
export function wrapText(text: string, maxWidth: number, size: number, measure: Measure): string[] {
  const lines: string[] = [];
  let current = '';
  const pushWord = (word: string) => {
    const candidate = current ? `${current} ${word}` : word;
    if (measure(candidate, size) <= maxWidth) {
      current = candidate;
      return;
    }
    if (current) lines.push(current);
    current = '';
    if (measure(word, size) <= maxWidth) {
      current = word;
      return;
    }
    let chunk = '';
    for (const ch of word) {
      if (measure(chunk + ch, size) > maxWidth && chunk) {
        lines.push(chunk);
        chunk = ch;
      } else chunk += ch;
    }
    current = chunk;
  };
  for (const word of text.split(' ').filter(Boolean)) pushWord(word);
  if (current) lines.push(current);
  return lines;
}

/**
 * Fits `text` into a form field rectangle without clipping: shrink first, then
 * (if allowed) wrap onto two lines, then shrink to the minimum size. Returns
 * `overflow` rather than ever drawing outside the field.
 */
export function layoutText(text: string, rect: Rect, style: TextStyle, measure: Measure): LayoutResult {
  if (!text) return { ok: true, fontSize: style.fontSize, lines: [] };
  const maxWidth = rect.width - 2 * PAD_X;
  const x = rect.x + PAD_X;

  const singleLine = (size: number): PlacedLine[] | null => {
    if (measure(text, size) > maxWidth) return null;
    if (size * CAP_HEIGHT > rect.height - 2 * PAD_Y) return null;
    const y = style.vAlign === 'underline' ? rect.y + UNDERLINE_BASELINE : rect.y + (rect.height - size * CAP_HEIGHT) / 2;
    return [{ text, x, y }];
  };

  const twoLines = (size: number): PlacedLine[] | null => {
    const lines = wrapText(text, maxWidth, size, measure);
    if (lines.length !== 2) return null;
    const blockHeight = size * CAP_HEIGHT + size * LINE_SPACING;
    if (blockHeight > rect.height - 2 * PAD_Y) return null;
    const bottom = rect.y + (rect.height - blockHeight) / 2;
    return [
      { text: lines[0], x, y: bottom + size * LINE_SPACING },
      { text: lines[1], x, y: bottom },
    ];
  };

  const preferWrapAt = Math.max(style.minFontSize, Math.min(style.fontSize, PREFER_WRAP_BELOW));
  for (const size of sizes(style.fontSize, preferWrapAt)) {
    const lines = singleLine(size);
    if (lines) return { ok: true, fontSize: size, lines };
  }
  if (style.wrap && style.vAlign === 'center') {
    for (const size of sizes(style.fontSize, style.minFontSize)) {
      const lines = twoLines(size);
      if (lines) return { ok: true, fontSize: size, lines };
    }
  }
  for (const size of sizes(preferWrapAt, style.minFontSize)) {
    const lines = singleLine(size);
    if (lines) return { ok: true, fontSize: size, lines };
  }
  return { ok: false, reason: 'overflow' };
}
