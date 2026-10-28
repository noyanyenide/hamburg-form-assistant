import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream, PDFRef, PDFStream } from 'pdf-lib';
import { beforeAll, describe, expect, it } from 'vitest';
import { generatePdf, planFill, readTemplateFields, embedFont, type TemplateField } from '../src/pdf/engine';
import { FIELD_MAPPINGS } from '../src/pdf/fieldMap';
import { loadTestAssets } from './helpers/assets';
import { extractText, type TextItem } from './helpers/pdftext';
import { fakeSignaturePng } from './helpers/png';
import { sampleValues } from './helpers/sample';

const assets = loadTestAssets();
let fields: Map<string, TemplateField>;
let measure: (t: string, s: number) => number;

beforeAll(async () => {
  fields = readTemplateFields(await PDFDocument.load(assets.template));
  const scratch = await PDFDocument.create();
  const font = await embedFont(scratch, assets.font);
  measure = (t, s) => font.widthOfTextAtSize(t, s);
});

function imageCount(doc: PDFDocument, pageIndex: number): number {
  const xobjects = doc.getPage(pageIndex).node.Resources()?.lookupMaybe(PDFName.of('XObject'), PDFDict);
  if (!xobjects) return 0;
  return xobjects.keys().filter((key) => {
    const obj = doc.context.lookup(xobjects.get(key));
    return obj instanceof PDFStream && obj.dict.get(PDFName.of('Subtype')) === PDFName.of('Image');
  }).length;
}

function contentStreams(doc: PDFDocument, pageIndex: number): Uint8Array[] {
  const page = doc.getPage(pageIndex);
  const contents = page.node.get(PDFName.of('Contents'));
  const resolved = doc.context.lookup(contents);
  const refs = resolved instanceof PDFArray ? resolved.asArray() : [contents];
  return refs.map((r) => {
    const stream = doc.context.lookup(r as PDFRef) as PDFStream;
    return stream instanceof PDFRawStream ? stream.contents : stream.getContents();
  });
}

describe('generatePdf with a complete application', () => {
  let bytes: Uint8Array;
  let out: PDFDocument;
  let text: TextItem[];

  beforeAll(async () => {
    const result = await generatePdf(assets, sampleValues(), { signaturePng: fakeSignaturePng() });
    expect(result.problems).toEqual([]);
    bytes = result.bytes;
    out = await PDFDocument.load(bytes);
    text = await extractText(bytes);
  });

  it('keeps both original pages and their dimensions', async () => {
    const original = await PDFDocument.load(assets.template);
    expect(out.getPageCount()).toBe(2);
    out.getPages().forEach((page, i) => {
      expect(page.getSize()).toEqual(original.getPage(i).getSize());
      expect(page.getRotation().angle).toBe(original.getPage(i).getRotation().angle);
    });
  });

  it('keeps the original printed content byte-for-byte', async () => {
    const original = await PDFDocument.load(assets.template);
    for (let i = 0; i < 2; i++) {
      const before = contentStreams(original, i).map((b) => Buffer.from(b).toString('base64'));
      const after = contentStreams(out, i).map((b) => Buffer.from(b).toString('base64'));
      for (const stream of before) expect(after).toContain(stream);
    }
  });

  it('is flattened: no form fields remain', () => {
    expect(out.catalog.get(PDFName.of('AcroForm'))).toBeUndefined();
    for (const page of out.getPages()) expect(page.node.Annots()?.size() ?? 0).toBe(0);
  });

  it('writes Turkish and German characters as real, extractable text', () => {
    const all = text.map((t) => t.str).join(' ');
    for (const word of ['Yılmaz', 'Öztürk', 'Ayşe Gül', 'İzmir', 'Große Bergstraße', 'Şükran', 'Mehmet Çağrı', 'Can Doğan', 'Müller & Söhne']) {
      expect(all).toContain(word);
    }
  });

  it('places every value inside the rectangle of its official field', () => {
    const plan = planFill(sampleValues(), fields, measure);
    const textOps = plan.ops.filter((o) => o.kind === 'text');
    expect(textOps.length).toBe(40);
    for (const op of textOps) {
      const field = fields.get(op.pdfField)!;
      for (const line of op.lines) {
        const hit = text.find((t) => t.page === op.page && t.str === line.text && Math.abs(t.x - line.x) < 0.5 && Math.abs(t.y - line.y) < 0.5);
        expect(hit, `${op.pdfField}: ${line.text}`).toBeDefined();
        expect(line.x).toBeGreaterThanOrEqual(field.rect.x);
        expect(line.x + measure(line.text, op.fontSize)).toBeLessThanOrEqual(field.rect.x + field.rect.width);
        expect(line.y).toBeGreaterThanOrEqual(field.rect.y);
        expect(line.y + op.fontSize * 0.714).toBeLessThanOrEqual(field.rect.y + field.rect.height);
      }
    }
  });

  it('formats combined fields in German', () => {
    const all = text.map((t) => t.str);
    expect(all).toContain('14.03.1988, İzmir');
    expect(all).toContain('Große Bergstraße 12a, bei Şahin, 22767 Hamburg');
    expect(all).toContain('+49 40 1234567 / ayse.yilmaz@example.org');
    expect(all).toContain('165 cm');
    expect(all).toContain('U12345678');
    expect(all).toContain('braun');
    expect(all).toContain('Familienzusammenführung – Ehegattennachzug');
    expect(all).toContain('eigene Erwerbstätigkeit, Einkommen des Ehegatten/Lebenspartners');
    expect(all).toContain('Öztürk, Hüseyin, 1960');
    expect(all).toContain('28.10.2026');
  });

  it('embeds the signature image on page 2 only', async () => {
    const original = await PDFDocument.load(assets.template);
    expect(imageCount(out, 0)).toBe(imageCount(original, 0));
    expect(imageCount(out, 1)).toBe(imageCount(original, 1) + 1);
  });
});

describe('check boxes and conditional answers', () => {
  it('ticks the German and the mirrored Turkish box for the chosen answers only', () => {
    const plan = planFill(sampleValues(), fields, measure);
    const checked = plan.ops.filter((o) => o.kind === 'check').map((o) => o.pdfField).sort();
    // married (DE + TR), expulsion: Nein, issue/extension: Ja + Evet, settlement permit: Nein + Hayır
    expect(checked).toEqual(['Check Box11', 'Check Box14', 'Check Box21', 'Check Box29', 'Check Box31', 'Check Box58', 'Check Box60'].sort());
  });

  it('never prints answers to questions that no longer apply', () => {
    const v = sampleValues();
    v.marital.status = 'single'; // spouse data stays in the draft but must not be printed
    v.children.hasChildren = 'no';
    v.entry.hadPreviousStays = 'no';
    const plan = planFill(v, fields, measure);
    const drawn = new Set(plan.ops.map((o) => o.pdfField));
    for (const name of ['undefined_33', 'undefined_35', 'undefined_36', 'undefined_37', 'undefined_38', 'Text27', 'Text28', 'Text1', 'Text3']) {
      expect(drawn.has(name), name).toBe(false);
    }
    expect(drawn.has('Check Box13')).toBe(true);
    expect(drawn.has('Check Box20')).toBe(true);
  });

  it('writes "in Deutschland geboren" for applicants born in Germany', () => {
    const v = sampleValues();
    v.entry.bornInGermany = true;
    const op = planFill(v, fields, measure).ops.find((o) => o.pdfField === 'undefined_14');
    expect(op?.kind === 'text' && op.lines[0].text).toBe('in Deutschland geboren');
  });

  it('prints "unbekannt" for unknown parents', () => {
    const v = sampleValues();
    v.parents.mother.unknown = true;
    const op = planFill(v, fields, measure).ops.find((o) => o.pdfField === 'undefined_40');
    expect(op?.kind === 'text' && op.lines[0].text).toBe('unbekannt');
  });

  it('fills the widowed date on both language rows', () => {
    const v = sampleValues();
    v.marital = { status: 'widowed', widowedSince: '05.2019' };
    const ops = planFill(v, fields, measure).ops;
    expect(ops.find((o) => o.pdfField === 'Text19')).toBeDefined();
    expect(ops.find((o) => o.pdfField === 'Text26')).toBeDefined();
    expect(ops.filter((o) => o.kind === 'check').map((o) => o.pdfField)).toEqual(expect.arrayContaining(['Check Box18', 'Check Box25']));
  });
});

describe('overflow protection', () => {
  it('refuses to generate when a value cannot fit and names the answer to shorten', async () => {
    const v = sampleValues();
    v.children.list[0].birthPlace = 'Sehr langer Ortsname mit vielen Wörtern der niemals in eine schmale Tabellenzelle passen kann';
    const result = await generatePdf(assets, v);
    expect(result.bytes.length).toBe(0);
    expect(result.problems).toEqual([{ pdfField: 'Text29', sourcePath: 'children.list.0.birthPlace', reason: 'overflow' }]);
  });

  it('fits the longest values the wizard accepts into the wide fields', () => {
    const v = sampleValues();
    v.applicant.surname = 'Ş'.repeat(60);
    v.stay.employerOrSchool = 'W'.repeat(90);
    const problems = planFill(v, fields, measure).problems;
    expect(problems).toEqual([]);
  });

  it('every mapping is exercised by the plan', () => {
    expect(FIELD_MAPPINGS.length).toBe(89);
  });
});

describe('signature', () => {
  it('omits the signature image when signing on paper', async () => {
    const original = await PDFDocument.load(assets.template);
    const without = await generatePdf(assets, sampleValues(), { signaturePng: null });
    expect(imageCount(await PDFDocument.load(without.bytes), 1)).toBe(imageCount(original, 1));
  });
});
