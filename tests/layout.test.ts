import { describe, expect, it } from 'vitest';
import type { TextStyle } from '../src/pdf/fieldMap';
import { CAP_HEIGHT, layoutText, wrapText } from '../src/pdf/layout';

// Simple deterministic metric: every character is 0.5 em wide.
const measure = (text: string, size: number) => [...text].length * size * 0.5;
const box = { x: 60, y: 700, width: 200, height: 16 };
const style: TextStyle = { fontSize: 10, minFontSize: 6, vAlign: 'center', wrap: true };

describe('layoutText', () => {
  it('keeps the preferred size when the text fits', () => {
    const r = layoutText('Hamburg', box, style, measure);
    expect(r.ok && r.fontSize).toBe(10);
    if (r.ok) {
      expect(r.lines).toHaveLength(1);
      expect(r.lines[0].x).toBeGreaterThan(box.x);
      // vertically centred on the cap height
      expect(r.lines[0].y).toBeCloseTo(box.y + (box.height - 10 * CAP_HEIGHT) / 2, 5);
    }
  });

  it('shrinks long text instead of clipping it', () => {
    const text = 'x'.repeat(45); // 225pt at 10pt, 194pt available
    const r = layoutText(text, box, style, measure);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.fontSize).toBeLessThan(10);
      expect(measure(text, r.fontSize)).toBeLessThanOrEqual(box.width - 6);
    }
  });

  it('wraps onto two lines before going below 7pt', () => {
    const text = 'Lorem ipsum dolor sit amet consectetur adipiscing elit sed do';
    const r = layoutText(text, box, style, measure);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.lines).toHaveLength(2);
      expect(r.lines[0].y).toBeGreaterThan(r.lines[1].y);
      expect(r.lines[1].y).toBeGreaterThanOrEqual(box.y);
    }
  });

  it('reports an overflow rather than drawing outside the field', () => {
    const r = layoutText('word '.repeat(80), box, style, measure);
    expect(r).toEqual({ ok: false, reason: 'overflow' });
  });

  it('puts underline-field text just above the printed line', () => {
    const r = layoutText('28.10.2026', { x: 118, y: 128, width: 100, height: 19 }, { ...style, vAlign: 'underline', wrap: false }, measure);
    expect(r.ok && r.lines[0].y).toBeCloseTo(130.5, 5);
  });

  it('returns nothing to draw for empty values', () => {
    expect(layoutText('', box, style, measure)).toEqual({ ok: true, fontSize: 10, lines: [] });
  });
});

describe('wrapText', () => {
  it('breaks words that are longer than a line', () => {
    const lines = wrapText('abcdefghij', 20, 10, measure);
    expect(lines).toEqual(['abcd', 'efgh', 'ij']);
  });
});
