import { createHash } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import { beforeAll, describe, expect, it } from 'vitest';
import { STEPS, isList } from '../src/form/steps';
import { TEMPLATE_SHA256 } from '../src/pdf/assets';
import { readTemplateFields, type TemplateField } from '../src/pdf/engine';
import { FIELD_MAPPINGS, SIGNATURE_AREA } from '../src/pdf/fieldMap';
import { loadTestAssets } from './helpers/assets';

let fields: Map<string, TemplateField>;
let doc: PDFDocument;
const assets = loadTestAssets();

beforeAll(async () => {
  doc = await PDFDocument.load(assets.template, { updateMetadata: false });
  fields = readTemplateFields(doc);
});

describe('official template', () => {
  it('is the unmodified original (checksum)', () => {
    expect(createHash('sha256').update(assets.template).digest('hex')).toBe(TEMPLATE_SHA256);
  });

  it('has two A4 pages', () => {
    expect(doc.getPageCount()).toBe(2);
    for (const page of doc.getPages()) {
      expect(page.getWidth()).toBeCloseTo(595.08, 1);
      expect(page.getHeight()).toBeCloseTo(841.68, 1);
    }
  });

  it('contains the 89 AcroForm widgets found during analysis', () => {
    expect(fields.size).toBe(89);
    const types = [...fields.values()].reduce<Record<string, number>>((acc, f) => ({ ...acc, [f.type]: (acc[f.type] ?? 0) + 1 }), {});
    expect(types).toEqual({ text: 67, checkbox: 22 });
  });
});

describe('field mapping', () => {
  it('maps every template field exactly once', () => {
    const mapped = FIELD_MAPPINGS.map((m) => m.pdfField);
    expect(new Set(mapped).size).toBe(mapped.length);
    expect([...mapped].sort()).toEqual([...fields.keys()].sort());
  });

  it('uses the right field kind and page for every mapping', () => {
    for (const m of FIELD_MAPPINGS) {
      const field = fields.get(m.pdfField)!;
      expect(field.type, m.pdfField).toBe(m.kind === 'text' ? 'text' : 'checkbox');
      expect(field.page, m.pdfField).toBe(m.page);
    }
  });

  it('only references answers that exist in the wizard', () => {
    const known = new Set<string>(['signing.date']);
    for (const step of STEPS)
      for (const item of step.items) {
        known.add(item.name);
        if (isList(item))
          for (let i = 0; i < item.max; i++) for (const f of item.itemFields) known.add(`${item.name}.${i}.${f.name}`);
      }
    for (const m of FIELD_MAPPINGS) for (const p of m.sourcePaths) expect(known.has(p), `${m.pdfField} → ${p}`).toBe(true);
  });

  it('prints every wizard answer somewhere on the form', () => {
    const used = new Set(FIELD_MAPPINGS.flatMap((m) => m.sourcePaths.map((p) => p.replace(/\.\d+\./, '.#.'))));
    const helperOnly = new Set(['entry.bornInGermany', 'entry.hadPreviousStays', 'children.hasChildren', 'parents.father.unknown', 'parents.mother.unknown', 'spouse.sameAddress']);
    for (const step of STEPS)
      for (const item of step.items) {
        if (isList(item)) {
          for (const f of item.itemFields) {
            const path = `${item.name}.#.${f.name}`;
            expect(used.has(path), path).toBe(true);
          }
        } else if (!helperOnly.has(item.name)) {
          expect(used.has(item.name), item.name).toBe(true);
        }
      }
  });

  it('places the signature inside page 2, clear of every form field', () => {
    const page = doc.getPage(SIGNATURE_AREA.page - 1);
    const a = SIGNATURE_AREA;
    expect(a.x).toBeGreaterThan(0);
    expect(a.y).toBeGreaterThan(0);
    expect(a.x + a.width).toBeLessThan(page.getWidth());
    expect(a.y + a.height).toBeLessThan(page.getHeight());
    for (const f of fields.values()) {
      if (f.page !== a.page) continue;
      const overlaps =
        a.x < f.rect.x + f.rect.width && f.rect.x < a.x + a.width && a.y < f.rect.y + f.rect.height && f.rect.y < a.y + a.height;
      expect(overlaps, f.name).toBe(false);
    }
  });
});
