import { EYE_COLORS, LIVELIHOOD, PURPOSES, optionByValue } from '../form/options';
import { MAX_CHILDREN, MAX_PREVIOUS_STAYS, type Child, type FormValues, type MaritalStatus, type Parent } from '../form/types';

/**
 * Central mapping between wizard answers and the official template
 * public/form/antrag-aufenthaltstitel-d-tr.pdf (2 pages, A4, AcroForm).
 *
 * How the template was analysed (see docs/FIELD-MAPPING.md):
 *  - The PDF contains 89 AcroForm widgets (text fields and check boxes) with
 *    generic names ("undefined_2", "Text27", "Check Box13" …). Every widget
 *    was matched to its printed label by overlaying the widget rectangles on a
 *    rendering of the page; all of them are mapped below.
 *  - The printed text is stored as images, so the PDF has no text layer.
 *  - The signature line has NO form field. Its position was measured from the
 *    rendered page (pixel analysis at 288 dpi) and is the only
 *    coordinate-based placement (SIGNATURE_AREA).
 *
 * Positions of AcroForm-backed values are always read from the template at
 * generation time (widget /Rect), never hard-coded here.
 *
 * All `value` functions receive *effective* values (see form/effective.ts):
 * answers to hidden questions are already blanked and text is normalised.
 */

export type VAlign = 'center' | 'underline';

export interface TextStyle {
  /** Preferred font size in pt. */
  fontSize: number;
  /** Smallest acceptable size before wrapping / reporting an overflow. */
  minFontSize: number;
  /** "underline" fields are a printed line; text sits just above it. */
  vAlign: VAlign;
  /** Allow wrapping onto a second line when one line does not fit. */
  wrap: boolean;
}

interface BaseMapping {
  /** AcroForm field name in the template. */
  pdfField: string;
  page: 1 | 2;
  /** Printed label next to the field (DE / TR), verbatim. */
  formLabel: string;
  /** Wizard answers feeding this field; the first receives "does not fit" errors. */
  sourcePaths: string[];
  note?: string;
}

export interface TextMapping extends BaseMapping {
  kind: 'text';
  style: TextStyle;
  value: (v: FormValues) => string;
}

export interface CheckMapping extends BaseMapping {
  kind: 'check';
  checked: (v: FormValues) => boolean;
}

export type FieldMapping = TextMapping | CheckMapping;

const BOX: TextStyle = { fontSize: 10, minFontSize: 6, vAlign: 'center', wrap: true };
const CELL: TextStyle = { fontSize: 9, minFontSize: 5.5, vAlign: 'center', wrap: true };
const LINE: TextStyle = { fontSize: 10, minFontSize: 6, vAlign: 'underline', wrap: false };

/**
 * Marital status and the two "Ja/Nein" requests are printed twice on page 2:
 * a German row and a Turkish row, each with its own check boxes. When true,
 * the same answer is ticked in both rows so neither row looks unanswered.
 */
export const MIRROR_TURKISH_ROWS = true;

/* ------------------------------ formatting helpers ----------------------------- */

export const joinNonEmpty = (parts: Array<string | undefined>, sep: string) =>
  parts.map((p) => (p ?? '').trim()).filter(Boolean).join(sep);

export function formatApplicantAddress(v: FormValues): string {
  const a = v.applicant;
  const street = joinNonEmpty([a.street, a.houseNumber], ' ');
  const city = joinNonEmpty([a.postalCode, a.city], ' ');
  return joinNonEmpty([street, a.addressAddition, city], ', ');
}

function eyeColor(v: FormValues): string {
  if (v.applicant.eyeColor === 'other') return v.applicant.eyeColorOther;
  return optionByValue(EYE_COLORS, v.applicant.eyeColor)?.pdf ?? '';
}

function purpose(v: FormValues): string {
  if (v.stay.purpose === 'other') return v.stay.purposeDetails;
  const label = optionByValue(PURPOSES, v.stay.purpose)?.pdf ?? '';
  return joinNonEmpty([label, v.stay.purposeDetails], ' – ');
}

function livelihood(v: FormValues): string {
  const parts = LIVELIHOOD.filter((o) => v.stay.livelihood.includes(o.value)).map((o) =>
    o.value === 'other' ? v.stay.livelihoodOther : o.pdf,
  );
  return joinNonEmpty(parts, ', ');
}

function parent(p: Parent): string {
  if (p.unknown) return 'unbekannt';
  return joinNonEmpty([p.surname, p.givenNames, p.birthDate], ', ');
}

/* ----------------------------------- page 1 ----------------------------------- */

const page1: FieldMapping[] = [
  { kind: 'text', pdfField: 'undefined_2', page: 1, formLabel: 'Name: / Soyadı:', sourcePaths: ['applicant.surname'], style: BOX, value: (v) => v.applicant.surname },
  { kind: 'text', pdfField: 'undefined_3', page: 1, formLabel: 'Geburtsname: / Kızlık adı:', sourcePaths: ['applicant.birthName'], style: BOX, value: (v) => v.applicant.birthName },
  { kind: 'text', pdfField: 'undefined_4', page: 1, formLabel: 'Vorname: / Adı:', sourcePaths: ['applicant.givenNames'], style: BOX, value: (v) => v.applicant.givenNames },
  {
    kind: 'text', pdfField: 'undefined_5', page: 1, formLabel: 'Geburtsdatum und -ort: / Doğum tarihi ve yeri:',
    sourcePaths: ['applicant.birthPlace', 'applicant.birthDate'], style: BOX,
    value: (v) => joinNonEmpty([v.applicant.birthDate, v.applicant.birthPlace], ', '),
  },
  { kind: 'text', pdfField: 'undefined_6', page: 1, formLabel: 'Staatsangehörigkeit: / Tabiiyeti:', sourcePaths: ['applicant.nationality'], style: BOX, value: (v) => v.applicant.nationality },
  {
    kind: 'text', pdfField: 'undefined_7', page: 1, formLabel: 'Aktuelle Anschrift: / Güncel ikamet adresi:',
    sourcePaths: ['applicant.street', 'applicant.houseNumber', 'applicant.addressAddition', 'applicant.postalCode', 'applicant.city'],
    style: BOX, value: formatApplicantAddress,
  },
  {
    kind: 'text', pdfField: 'undefined_8', page: 1,
    formLabel: 'Telefon / E-Mail Adresse (für mögliche Rückfragen / Angabe freiwillig): / Telefon / E-posta adresi (muhtemel geri dönüşler için / zorunlu değildir):',
    sourcePaths: ['applicant.email', 'applicant.phone'], style: BOX,
    value: (v) => joinNonEmpty([v.applicant.phone, v.applicant.email], ' / '),
  },
  { kind: 'text', pdfField: 'undefined_9', page: 1, formLabel: 'Augenfarbe / Göz rengi', sourcePaths: ['applicant.eyeColorOther', 'applicant.eyeColor'], style: BOX, value: eyeColor },
  {
    kind: 'text', pdfField: 'undefined_10', page: 1, formLabel: 'Größe / boyu', sourcePaths: ['applicant.heightCm'], style: BOX,
    value: (v) => (v.applicant.heightCm ? `${v.applicant.heightCm} cm` : ''),
  },
  {
    kind: 'text', pdfField: 'undefined_11', page: 1, formLabel: 'Nr. des Passes: / Pasaport no:', sourcePaths: ['passport.number'], style: BOX,
    value: (v) => v.passport.number.toUpperCase(),
  },
  {
    kind: 'text', pdfField: 'undefined_12', page: 1, formLabel: 'Ort und Datum der Ausstellung: / Verildiği yer ve tarih',
    sourcePaths: ['passport.issuePlace', 'passport.issueDate'], style: BOX,
    value: (v) => joinNonEmpty([v.passport.issuePlace, v.passport.issueDate], ', '),
  },
  { kind: 'text', pdfField: 'undefined_13', page: 1, formLabel: 'Gültig bis: / Geçerlilik sürsi', sourcePaths: ['passport.validUntil'], style: BOX, value: (v) => v.passport.validUntil },
  {
    kind: 'text', pdfField: 'undefined_14', page: 1,
    formLabel: 'Die Einreise in das Bundesgebiet erfolgte am: / Federal bölgeye (Almanya’ya) geliş tarihi:',
    sourcePaths: ['entry.entryDate'], style: BOX,
    value: (v) => (v.entry.bornInGermany ? 'in Deutschland geboren' : v.entry.entryDate),
    note: 'If the applicant ticks "born in Germany" the field reads "in Deutschland geboren" instead of a date.',
  },
  // Voraufenthalte im Bundesgebiet: 3 printed rows × (von | bis | in) = Text1 … Text9
  ...Array.from({ length: MAX_PREVIOUS_STAYS }, (_, row): FieldMapping[] => {
    const base = 1 + row * 3;
    const stay = (v: FormValues) => v.entry.previousStays[row];
    return [
      { kind: 'text', pdfField: `Text${base}`, page: 1, formLabel: `Voraufenthalte, Zeile ${row + 1}: von / Bu tarihten`, sourcePaths: [`entry.previousStays.${row}.from`], style: CELL, value: (v) => stay(v)?.from ?? '' },
      { kind: 'text', pdfField: `Text${base + 1}`, page: 1, formLabel: `Voraufenthalte, Zeile ${row + 1}: bis / Bu tarihe kadar`, sourcePaths: [`entry.previousStays.${row}.to`], style: CELL, value: (v) => stay(v)?.to ?? '' },
      { kind: 'text', pdfField: `Text${base + 2}`, page: 1, formLabel: `Voraufenthalte, Zeile ${row + 1}: in / İkamet edilen yer`, sourcePaths: [`entry.previousStays.${row}.place`], style: CELL, value: (v) => stay(v)?.place ?? '' },
    ];
  }).flat(),
  {
    kind: 'check', pdfField: 'Check Box10', page: 1, formLabel: 'Ausweisung/Abschiebung/Ablehnung: Ja, wann / Evet ise, ne zaman',
    sourcePaths: ['history.expelledOrRefused'], checked: (v) => v.history.expelledOrRefused === 'yes',
  },
  {
    kind: 'text', pdfField: 'Text12', page: 1, formLabel: 'Ja, wann / Evet ise, ne zaman ______', sourcePaths: ['history.expelledWhen'], style: LINE,
    value: (v) => v.history.expelledWhen,
  },
  {
    kind: 'check', pdfField: 'Check Box11', page: 1, formLabel: 'Ausweisung/Abschiebung/Ablehnung: Nein / Hayır',
    sourcePaths: ['history.expelledOrRefused'], checked: (v) => v.history.expelledOrRefused === 'no',
  },
  { kind: 'text', pdfField: 'undefined_18', page: 1, formLabel: 'Zweck des Aufenthaltes im Bundesgebiet: / Federal Bölgede ikamet amacınız:', sourcePaths: ['stay.purposeDetails', 'stay.purpose'], style: BOX, value: purpose },
  { kind: 'text', pdfField: 'undefined_19', page: 1, formLabel: 'Arbeitgeber/Studienanstalt / İşveren / Eğitim kurumu:', sourcePaths: ['stay.employerOrSchool'], style: BOX, value: (v) => v.stay.employerOrSchool },
  {
    kind: 'text', pdfField: 'undefined_20', page: 1,
    formLabel: 'Aus welchen Mitteln wird der Lebensunterhalt bestritten? / Geçiminizi hangi imkanlarla sağlıyorsunuz?',
    sourcePaths: ['stay.livelihoodOther', 'stay.livelihood'], style: BOX, value: livelihood,
  },
];

/* ----------------------------------- page 2 ----------------------------------- */

const MARITAL_BOXES: Array<{ status: Exclude<MaritalStatus, ''>; de: string; tr: string; label: string }> = [
  { status: 'single', de: 'Check Box13', tr: 'Check Box20', label: 'Ledig / bekar' },
  { status: 'married', de: 'Check Box14', tr: 'Check Box21', label: 'verheiratet / evli' },
  { status: 'partnership', de: 'Check Box15', tr: 'Check Box22', label: 'Lebenspartnerschaft / hayat arkadaşlığı' },
  { status: 'separated', de: 'Check Box16', tr: 'Check Box23', label: 'getrennt lebend / ayrı yaşıyor' },
  { status: 'divorced', de: 'Check Box17', tr: 'Check Box24', label: 'geschieden / boşanmış' },
  { status: 'widowed', de: 'Check Box18', tr: 'Check Box25', label: 'verwitwet seit / dul' },
];

const maritalChecks: FieldMapping[] = MARITAL_BOXES.flatMap(({ status, de, tr, label }): FieldMapping[] => [
  { kind: 'check', pdfField: de, page: 2, formLabel: `Familienstand (deutsche Zeile): ${label}`, sourcePaths: ['marital.status'], checked: (v) => v.marital.status === status },
  {
    kind: 'check', pdfField: tr, page: 2, formLabel: `Medeni Hali (türkische Zeile): ${label}`, sourcePaths: ['marital.status'],
    checked: (v) => MIRROR_TURKISH_ROWS && v.marital.status === status,
    note: 'Turkish row mirrors the German row (MIRROR_TURKISH_ROWS).',
  },
]);

const spouseAddress = (v: FormValues) => (v.spouse.sameAddress ? formatApplicantAddress(v) : v.spouse.address);
const spouseActive = (v: FormValues) => v.spouse.surname !== '' || v.spouse.givenNames !== '';

const CHILD_COLUMNS: Array<{ label: string; path: keyof Child | 'birth'; value: (c: Child) => string }> = [
  { label: 'Name / Soyadı', path: 'surname', value: (c) => c.surname },
  { label: 'Vorname / Adı', path: 'givenNames', value: (c) => c.givenNames },
  { label: 'Geburtstag -ort / Doğum tarihi ve yeri', path: 'birth', value: (c) => joinNonEmpty([c.birthDate, c.birthPlace], ', ') },
  { label: 'Staatsangehörigkeit / Tabiiyeti', path: 'nationality', value: (c) => c.nationality },
  { label: 'Wohnort / İkamet adresi', path: 'residence', value: (c) => c.residence },
];

const yesNoChecks = (
  question: 'issueOrExtension' | 'settlementPermit',
  boxes: { ja: string; nein: string; evet: string; hayir: string },
  label: string,
): FieldMapping[] => {
  const path = `application.${question}`;
  const is = (v: FormValues, a: 'yes' | 'no') => v.application[question] === a;
  const mirror = 'Turkish row mirrors the German row (MIRROR_TURKISH_ROWS).';
  return [
    { kind: 'check', pdfField: boxes.ja, page: 2, formLabel: `${label} – Ja`, sourcePaths: [path], checked: (v) => is(v, 'yes') },
    { kind: 'check', pdfField: boxes.nein, page: 2, formLabel: `${label} – Nein`, sourcePaths: [path], checked: (v) => is(v, 'no') },
    { kind: 'check', pdfField: boxes.evet, page: 2, formLabel: `${label} – Evet`, sourcePaths: [path], checked: (v) => MIRROR_TURKISH_ROWS && is(v, 'yes'), note: mirror },
    { kind: 'check', pdfField: boxes.hayir, page: 2, formLabel: `${label} – Hayır`, sourcePaths: [path], checked: (v) => MIRROR_TURKISH_ROWS && is(v, 'no'), note: mirror },
  ];
};

const page2: FieldMapping[] = [
  ...maritalChecks,
  { kind: 'text', pdfField: 'Text19', page: 2, formLabel: 'verwitwet seit: ______', sourcePaths: ['marital.widowedSince'], style: LINE, value: (v) => v.marital.widowedSince },
  {
    kind: 'text', pdfField: 'Text26', page: 2, formLabel: 'dul: ______ tarihinden beri', sourcePaths: ['marital.widowedSince'], style: LINE,
    value: (v) => (MIRROR_TURKISH_ROWS ? v.marital.widowedSince : ''),
    note: 'Turkish row mirrors the German row (MIRROR_TURKISH_ROWS).',
  },
  { kind: 'text', pdfField: 'undefined_33', page: 2, formLabel: 'Ehegatte/Lebenspartner – Name: / Soyadı:', sourcePaths: ['spouse.surname'], style: BOX, value: (v) => v.spouse.surname },
  { kind: 'text', pdfField: 'undefined_34', page: 2, formLabel: 'Ehegatte/Lebenspartner – Geburtsname: / Kızlık adı:', sourcePaths: ['spouse.birthName'], style: BOX, value: (v) => v.spouse.birthName },
  { kind: 'text', pdfField: 'undefined_35', page: 2, formLabel: 'Ehegatte/Lebenspartner – Vorname: / Adı:', sourcePaths: ['spouse.givenNames'], style: BOX, value: (v) => v.spouse.givenNames },
  {
    kind: 'text', pdfField: 'undefined_36', page: 2, formLabel: 'Ehegatte/Lebenspartner – Geburtsdatum und -ort: / Doğum tarihi ve yeri:',
    sourcePaths: ['spouse.birthPlace', 'spouse.birthDate'], style: BOX,
    value: (v) => joinNonEmpty([v.spouse.birthDate, v.spouse.birthPlace], ', '),
  },
  { kind: 'text', pdfField: 'undefined_37', page: 2, formLabel: 'Ehegatte/Lebenspartner – Staatsangehörigkeit: / Tabiiyeti:', sourcePaths: ['spouse.nationality'], style: BOX, value: (v) => v.spouse.nationality },
  {
    kind: 'text', pdfField: 'undefined_38', page: 2, formLabel: 'Ehegatte/Lebenspartner – Aktuelle Anschrift: /: Güncel ikamet adresi:',
    sourcePaths: ['spouse.address', 'spouse.sameAddress'], style: BOX,
    value: (v) => (spouseActive(v) ? spouseAddress(v) : ''),
    note: '"Same address as mine" prints the applicant’s address.',
  },
  // Kinder des Antragstellers: 6 printed rows × 5 columns = Text27 … Text56
  ...Array.from({ length: MAX_CHILDREN }, (_, row) =>
    CHILD_COLUMNS.map((col, c): FieldMapping => ({
      kind: 'text',
      pdfField: `Text${27 + row * 5 + c}`,
      page: 2,
      formLabel: `Kinder, Zeile ${row + 1}: ${col.label}`,
      sourcePaths: col.path === 'birth' ? [`children.list.${row}.birthPlace`, `children.list.${row}.birthDate`] : [`children.list.${row}.${col.path}`],
      style: CELL,
      value: (v) => {
        const child = v.children.list[row];
        return child ? col.value(child) : '';
      },
    })),
  ).flat(),
  {
    kind: 'text', pdfField: 'undefined_39', page: 2, formLabel: 'Vater (Name, Vorname, Geburtsdatum) / Babası (Soyadı, adı, doğum tarihi)',
    sourcePaths: ['parents.father.surname', 'parents.father.givenNames', 'parents.father.birthDate'], style: BOX,
    value: (v) => parent(v.parents.father),
  },
  {
    kind: 'text', pdfField: 'undefined_40', page: 2, formLabel: 'Mutter (Name, Vorname, Geburtsdatum) / Annesi (Soyadı, adı, doğum tarihi)',
    sourcePaths: ['parents.mother.surname', 'parents.mother.givenNames', 'parents.mother.birthDate'], style: BOX,
    value: (v) => parent(v.parents.mother),
  },
  ...yesNoChecks(
    'issueOrExtension',
    { ja: 'Check Box29', nein: 'Check Box30', evet: 'Check Box31', hayir: 'Check Box32' },
    'Ich beantrage die Erteilung / Verlängerung des Aufenthaltstitels',
  ),
  ...yesNoChecks(
    'settlementPermit',
    { ja: 'Check Box57', nein: 'Check Box58', evet: 'Check Box59', hayir: 'Check Box60' },
    'Ich beantrage einen unbefristeten Aufenthaltstitel (Niederlassungserlaubnis)',
  ),
  {
    kind: 'text', pdfField: 'Text61', page: 2, formLabel: 'Hamburg, den ______ / Hamburg,', sourcePaths: ['signing.date'], style: LINE,
    value: (v) => v.signing.date,
  },
];

export const FIELD_MAPPINGS: readonly FieldMapping[] = [...page1, ...page2];

/**
 * "Eigenhändige Unterschrift des Antragstellers / Dilekçe sahibinin kendi eli
 * ile imzası" — page 2. No form field exists; the area lies between the
 * printed signature line (y ≈ 81.8 pt, x 62–249 pt) and the "Hamburg," text
 * above it (lowest ink at y ≈ 116.7 pt). Measured from a 288-dpi rendering.
 * PDF user-space units (pt), origin bottom-left.
 */
export const SIGNATURE_AREA = {
  page: 2 as const,
  x: 64,
  y: 83,
  width: 182,
  height: 31,
  formLabel: 'Eigenhändige Unterschrift des Antragstellers / Dilekçe sahibinin kendi eli ile imzası',
  status: 'coordinate-based' as const,
};

/**
 * Template elements that intentionally receive no input:
 *  - "bitte 1 biometrisches Passbild beifügen / Lütfen 1 adet biometrik fotoğrak ekleyiniz":
 *    a reminder only; the photo is attached physically, the form has no photo box.
 *  - Form code "E / Z - 008.40/180 - 12.08" (page 1, left margin).
 *  - "Hamburg, den" / "Hamburg," is pre-printed; only the date is filled in.
 * There are no fields reserved for the authority on this form.
 */
export const INTENTIONALLY_EMPTY = [
  'Passbild-Hinweis (no photo box on the form)',
  'Formularkennung E / Z - 008.40/180 - 12.08',
] as const;
