import fontkit from '@pdf-lib/fontkit';
import {
  PDFArray,
  PDFCheckBox,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFRef,
  PDFTextField,
  rgb,
  type PDFFont,
  type PDFPage,
  type PDFWidgetAnnotation,
} from 'pdf-lib';
import { effectiveValues } from '../form/effective';
import type { FormValues } from '../form/types';
import { FIELD_MAPPINGS, SIGNATURE_AREA, type FieldMapping } from './fieldMap';
import { layoutText, type Measure, type PlacedLine, type Rect } from './layout';

export interface PdfAssets {
  template: Uint8Array;
  font: Uint8Array;
}

export interface TemplateField {
  name: string;
  type: 'text' | 'checkbox' | 'other';
  /** 1-based page number. */
  page: number;
  rect: Rect;
}

export interface FieldProblem {
  pdfField: string;
  /** Wizard answer that should be changed to fix the problem. */
  sourcePath: string;
  reason: 'overflow' | 'missing-field' | 'wrong-page';
}

export type DrawOp =
  | { kind: 'text'; page: number; pdfField: string; fontSize: number; lines: PlacedLine[] }
  | { kind: 'check'; page: number; pdfField: string; rect: Rect };

export interface FillPlan {
  ops: DrawOp[];
  problems: FieldProblem[];
}

const INK = rgb(0, 0, 0);

function widgetPageIndex(doc: PDFDocument, widget: PDFWidgetAnnotation): number {
  const ref = doc.context.getObjectRef(widget.dict);
  const pages = doc.getPages();
  for (let i = 0; i < pages.length; i++) {
    const annots = pages[i].node.Annots();
    if (!annots) continue;
    for (let j = 0; j < annots.size(); j++) {
      const entry = annots.get(j);
      if (entry === widget.dict || (ref && entry instanceof PDFRef && entry === ref)) return i;
    }
  }
  return -1;
}

/** Reads every AcroForm widget of the template (name, type, page, rectangle). */
export function readTemplateFields(doc: PDFDocument): Map<string, TemplateField> {
  const result = new Map<string, TemplateField>();
  for (const field of doc.getForm().getFields()) {
    const widget = field.acroField.getWidgets()[0];
    if (!widget) continue;
    const r = widget.getRectangle();
    result.set(field.getName(), {
      name: field.getName(),
      type: field instanceof PDFTextField ? 'text' : field instanceof PDFCheckBox ? 'checkbox' : 'other',
      page: widgetPageIndex(doc, widget) + 1,
      rect: { x: r.x, y: r.y, width: r.width, height: r.height },
    });
  }
  return result;
}

/**
 * Pure planning step: decides what goes where without touching the PDF.
 * Used both for generation and for the live "does it fit on the form?" check.
 */
export function planFill(
  values: FormValues,
  fields: Map<string, TemplateField>,
  measure: Measure,
  mappings: readonly FieldMapping[] = FIELD_MAPPINGS,
): FillPlan {
  const v = effectiveValues(values);
  const ops: DrawOp[] = [];
  const problems: FieldProblem[] = [];
  for (const m of mappings) {
    const field = fields.get(m.pdfField);
    const sourcePath = m.sourcePaths[0];
    if (!field) {
      problems.push({ pdfField: m.pdfField, sourcePath, reason: 'missing-field' });
      continue;
    }
    if (field.page !== m.page) {
      problems.push({ pdfField: m.pdfField, sourcePath, reason: 'wrong-page' });
      continue;
    }
    if (m.kind === 'check') {
      if (m.checked(v)) ops.push({ kind: 'check', page: field.page, pdfField: m.pdfField, rect: field.rect });
      continue;
    }
    const text = m.value(v);
    if (!text) continue;
    const layout = layoutText(text, field.rect, m.style, measure);
    if (!layout.ok) {
      problems.push({ pdfField: m.pdfField, sourcePath, reason: 'overflow' });
      continue;
    }
    ops.push({ kind: 'text', page: field.page, pdfField: m.pdfField, fontSize: layout.fontSize, lines: layout.lines });
  }
  return { ops, problems };
}

/** Same cross as the template's own check-box appearance (/MK /CA "8"). */
function drawCross(page: PDFPage, rect: Rect): void {
  const inset = Math.min(2, Math.min(rect.width, rect.height) * 0.2);
  const x0 = rect.x + inset;
  const y0 = rect.y + inset;
  const x1 = rect.x + rect.width - inset;
  const y1 = rect.y + rect.height - inset;
  page.drawLine({ start: { x: x0, y: y0 }, end: { x: x1, y: y1 }, thickness: 1, color: INK });
  page.drawLine({ start: { x: x0, y: y1 }, end: { x: x1, y: y0 }, thickness: 1, color: INK });
}

/**
 * Removes all form widgets and the AcroForm dictionary. pdf-lib's
 * PDFForm.removeField() cannot be used: it requires an appearance stream on
 * every widget, which many fields of this template do not have.
 */
function removeFormWidgets(doc: PDFDocument): void {
  const widget = PDFName.of('Widget');
  for (const page of doc.getPages()) {
    const annots = page.node.Annots();
    if (!annots) continue;
    const keep = [];
    for (let i = 0; i < annots.size(); i++) {
      const entry = annots.get(i);
      const dict = doc.context.lookup(entry);
      if (dict instanceof PDFDict && dict.get(PDFName.of('Subtype')) === widget) {
        if (entry instanceof PDFRef) doc.context.delete(entry);
        continue;
      }
      keep.push(entry);
    }
    if (keep.length === 0) page.node.delete(PDFName.of('Annots'));
    else page.node.set(PDFName.of('Annots'), PDFArray.withContext(doc.context));
    if (keep.length > 0) {
      const arr = page.node.lookup(PDFName.of('Annots'), PDFArray);
      for (const entry of keep) arr.push(entry);
    }
  }
  doc.catalog.delete(PDFName.of('AcroForm'));
}

export async function embedFont(doc: PDFDocument, fontBytes: Uint8Array): Promise<PDFFont> {
  doc.registerFontkit(fontkit);
  // The bundled font is already a small Latin subset; pdf-lib's own subsetting is not needed.
  return doc.embedFont(fontBytes, { subset: false });
}

export interface FitChecker {
  check(values: FormValues): FieldProblem[];
}

export async function createFitChecker(assets: PdfAssets): Promise<FitChecker> {
  const template = await PDFDocument.load(assets.template, { updateMetadata: false });
  const fields = readTemplateFields(template);
  const scratch = await PDFDocument.create();
  const font = await embedFont(scratch, assets.font);
  const measure: Measure = (t, s) => font.widthOfTextAtSize(t, s);
  return { check: (values) => planFill(values, fields, measure).problems };
}

export interface GenerateOptions {
  /** PNG bytes of the drawn signature (transparent background). */
  signaturePng?: Uint8Array | null;
  now?: Date;
}

export interface GenerateResult {
  bytes: Uint8Array;
  problems: FieldProblem[];
}

/**
 * Fills the original template. Pages, page sizes and all printed content stay
 * untouched; only the answers, crosses and the signature are drawn on top.
 * Afterwards the (now redundant) AcroForm widgets are removed, which flattens
 * the document: the values cannot be altered unnoticed in a PDF viewer and
 * every viewer shows the same result. Nothing is drawn if any value would not
 * fit into its field — the caller gets the problems instead.
 */
export async function generatePdf(assets: PdfAssets, values: FormValues, options: GenerateOptions = {}): Promise<GenerateResult> {
  const doc = await PDFDocument.load(assets.template, { updateMetadata: false });
  const font = await embedFont(doc, assets.font);
  const fields = readTemplateFields(doc);
  const plan = planFill(values, fields, (t, s) => font.widthOfTextAtSize(t, s));
  if (plan.problems.length > 0) return { bytes: new Uint8Array(), problems: plan.problems };

  const pages = doc.getPages();
  for (const op of plan.ops) {
    const page = pages[op.page - 1];
    if (op.kind === 'check') drawCross(page, op.rect);
    else for (const line of op.lines) page.drawText(line.text, { x: line.x, y: line.y, size: op.fontSize, font, color: INK });
  }

  if (options.signaturePng && options.signaturePng.length > 0) {
    const image = await doc.embedPng(options.signaturePng);
    const area = SIGNATURE_AREA;
    const scale = Math.min(area.width / image.width, area.height / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    pages[area.page - 1].drawImage(image, { x: area.x, y: area.y, width, height });
  }

  removeFormWidgets(doc);
  doc.setModificationDate(options.now ?? new Date());

  // Field appearances must not be regenerated: the widgets no longer exist.
  const bytes = await doc.save({ useObjectStreams: false, updateFieldAppearances: false });
  return { bytes, problems: [] };
}
