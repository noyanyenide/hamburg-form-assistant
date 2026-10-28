import type { z } from 'zod';
import type { MessageKey } from '../i18n/types';
import { EYE_COLORS, LIVELIHOOD, MARITAL_STATUSES, PURPOSES, type ChoiceOption } from './options';
import { MAX_CHILDREN, MAX_PREVIOUS_STAYS, emptyChild, emptyPreviousStay, type FormValues } from './types';
import {
  zAnyDate,
  zEmail,
  zHeight,
  zPartialPastDate,
  zPassportNumber,
  zPastDate,
  zPhone,
  zPostalCode,
  zText,
} from './validators';

/**
 * Declarative description of the wizard. One definition drives rendering,
 * validation (src/form/schema.ts) and the review screen, so the three can never
 * drift apart. `formRef` is the label printed on the official PDF, verbatim.
 */
export type FieldType = 'text' | 'date' | 'partialDate' | 'number' | 'select' | 'radio' | 'yesNo' | 'checkbox' | 'multi';

export interface FieldMeta {
  /** Path relative to the step root (or to a list item). */
  name: string;
  type: FieldType;
  label: MessageKey;
  help?: MessageKey;
  placeholder?: MessageKey;
  formRef?: string;
  options?: readonly ChoiceOption[];
  required?: boolean | ((v: FormValues) => boolean);
  visible?: (v: FormValues) => boolean;
  format?: z.ZodType<string>;
  autoComplete?: string;
  inputMode?: 'text' | 'numeric' | 'tel' | 'email' | 'decimal';
  autoCapitalize?: 'none' | 'words' | 'characters' | 'sentences';
  suggestions?: readonly string[];
  /** Narrow inputs share a row on wider screens. */
  width?: 'full' | 'half' | 'third';
  /** Offers a one-tap button that copies another answer into this field. */
  copyFrom?: { path: string; label: MessageKey };
}

export interface ListMeta {
  name: string;
  type: 'list';
  label: MessageKey;
  itemLabel: MessageKey;
  addLabel: MessageKey;
  max: number;
  formRef?: string;
  visible?: (v: FormValues) => boolean;
  newItem: () => Record<string, string>;
  itemFields: FieldMeta[];
}

export type StepItem = FieldMeta | ListMeta;

export type StepId =
  | 'applicantName'
  | 'applicantBirth'
  | 'applicantAddress'
  | 'applicantAppearance'
  | 'passport'
  | 'entry'
  | 'history'
  | 'stay'
  | 'marital'
  | 'spouse'
  | 'children'
  | 'parents'
  | 'application';

export interface StepDef {
  id: StepId;
  title: MessageKey;
  intro?: MessageKey;
  /** Section heading of the official form (DE / TR), shown for orientation. */
  formSection?: string;
  visible?: (v: FormValues) => boolean;
  items: StepItem[];
}

const NATIONALITY_SUGGESTIONS = ['türkisch', 'deutsch', 'türkisch und deutsch'] as const;

export const hasSpouse = (v: FormValues) =>
  v.marital.status === 'married' || v.marital.status === 'partnership' || v.marital.status === 'separated';

const SEC_PERSON = 'Angaben zur Person des Antragstellers / Dilekçe sahibinin kimliğine dair bilgiler';
const SEC_PASS = 'Angaben zu Pass/Passersatz / Pasaportuna/Yedek kimlik belgesine ilişkin bilgiler';
const SEC_ENTRY =
  'Angaben zu Einreise, Voraufenthalten und Zweck des Aufenthaltes / Ülkeye gelişi, önceki ikametleri ve ikamet amacı ile ilgili bilgiler';

export const STEPS: readonly StepDef[] = [
  {
    id: 'applicantName',
    title: 'step.applicantName.title',
    intro: 'step.applicantName.intro',
    formSection: SEC_PERSON,
    items: [
      {
        name: 'applicant.surname',
        type: 'text',
        label: 'field.surname',
        help: 'help.surname',
        formRef: 'Name: / Soyadı:',
        required: true,
        format: zText(60),
        autoComplete: 'family-name',
        autoCapitalize: 'words',
      },
      {
        name: 'applicant.birthName',
        type: 'text',
        label: 'field.birthName',
        help: 'help.birthName',
        formRef: 'Geburtsname: / Kızlık adı:',
        format: zText(60),
        autoCapitalize: 'words',
      },
      {
        name: 'applicant.givenNames',
        type: 'text',
        label: 'field.givenNames',
        help: 'help.givenNames',
        formRef: 'Vorname: / Adı:',
        required: true,
        format: zText(60),
        autoComplete: 'given-name',
        autoCapitalize: 'words',
      },
    ],
  },
  {
    id: 'applicantBirth',
    title: 'step.applicantBirth.title',
    formSection: SEC_PERSON,
    items: [
      {
        name: 'applicant.birthDate',
        type: 'date',
        label: 'field.birthDate',
        formRef: 'Geburtsdatum und -ort: / Doğum tarihi ve yeri:',
        required: true,
        format: zPastDate,
        autoComplete: 'bday',
      },
      {
        name: 'applicant.birthPlace',
        type: 'text',
        label: 'field.birthPlace',
        help: 'help.birthPlace',
        formRef: 'Geburtsdatum und -ort: / Doğum tarihi ve yeri:',
        required: true,
        format: zText(50),
        autoCapitalize: 'words',
      },
      {
        name: 'applicant.nationality',
        type: 'text',
        label: 'field.nationality',
        help: 'help.nationality',
        formRef: 'Staatsangehörigkeit: / Tabiiyeti:',
        required: true,
        format: zText(60),
        suggestions: NATIONALITY_SUGGESTIONS,
      },
    ],
  },
  {
    id: 'applicantAddress',
    title: 'step.applicantAddress.title',
    intro: 'step.applicantAddress.intro',
    formSection: SEC_PERSON,
    items: [
      {
        name: 'applicant.street',
        type: 'text',
        label: 'field.street',
        formRef: 'Aktuelle Anschrift: / Güncel ikamet adresi:',
        required: true,
        format: zText(50),
        autoComplete: 'address-line1',
        width: 'full',
      },
      {
        name: 'applicant.houseNumber',
        type: 'text',
        label: 'field.houseNumber',
        required: true,
        format: zText(10),
        width: 'third',
      },
      {
        name: 'applicant.addressAddition',
        type: 'text',
        label: 'field.addressAddition',
        help: 'help.addressAddition',
        format: zText(40),
        autoComplete: 'address-line2',
      },
      {
        name: 'applicant.postalCode',
        type: 'text',
        label: 'field.postalCode',
        required: true,
        format: zPostalCode,
        autoComplete: 'postal-code',
        inputMode: 'numeric',
        width: 'third',
      },
      {
        name: 'applicant.city',
        type: 'text',
        label: 'field.city',
        required: true,
        format: zText(40),
        autoComplete: 'address-level2',
        width: 'half',
      },
      {
        name: 'applicant.phone',
        type: 'text',
        label: 'field.phone',
        help: 'help.contactOptional',
        formRef:
          'Telefon / E-Mail Adresse (für mögliche Rückfragen / Angabe freiwillig): / Telefon / E-posta adresi (muhtemel geri dönüşler için / zorunlu değildir):',
        format: zPhone,
        autoComplete: 'tel',
        inputMode: 'tel',
      },
      {
        name: 'applicant.email',
        type: 'text',
        label: 'field.email',
        format: zEmail,
        autoComplete: 'email',
        inputMode: 'email',
        autoCapitalize: 'none',
      },
    ],
  },
  {
    id: 'applicantAppearance',
    title: 'step.applicantAppearance.title',
    formSection: SEC_PERSON,
    items: [
      {
        name: 'applicant.eyeColor',
        type: 'select',
        label: 'field.eyeColor',
        formRef: 'Augenfarbe / Göz rengi',
        options: EYE_COLORS,
        required: true,
      },
      {
        name: 'applicant.eyeColorOther',
        type: 'text',
        label: 'field.eyeColorOther',
        help: 'help.writeInGerman',
        required: true,
        visible: (v) => v.applicant.eyeColor === 'other',
        format: zText(30),
      },
      {
        name: 'applicant.heightCm',
        type: 'number',
        label: 'field.heightCm',
        help: 'help.heightCm',
        formRef: 'Größe / boyu',
        required: true,
        format: zHeight,
        inputMode: 'numeric',
        width: 'half',
      },
    ],
  },
  {
    id: 'passport',
    title: 'step.passport.title',
    intro: 'step.passport.intro',
    formSection: SEC_PASS,
    items: [
      {
        name: 'passport.number',
        type: 'text',
        label: 'field.passportNumber',
        formRef: 'Nr. des Passes: / Pasaport no:',
        required: true,
        format: zPassportNumber,
        autoCapitalize: 'characters',
      },
      {
        name: 'passport.issuePlace',
        type: 'text',
        label: 'field.passportIssuePlace',
        formRef: 'Ort und Datum der Ausstellung: / Verildiği yer ve tarih',
        required: true,
        format: zText(50),
        autoCapitalize: 'words',
      },
      {
        name: 'passport.issueDate',
        type: 'date',
        label: 'field.passportIssueDate',
        formRef: 'Ort und Datum der Ausstellung: / Verildiği yer ve tarih',
        required: true,
        format: zPastDate,
      },
      {
        name: 'passport.validUntil',
        type: 'date',
        label: 'field.passportValidUntil',
        formRef: 'Gültig bis: / Geçerlilik sürsi',
        required: true,
        format: zAnyDate,
      },
    ],
  },
  {
    id: 'entry',
    title: 'step.entry.title',
    formSection: SEC_ENTRY,
    items: [
      {
        name: 'entry.bornInGermany',
        type: 'checkbox',
        label: 'field.bornInGermany',
      },
      {
        name: 'entry.entryDate',
        type: 'date',
        label: 'field.entryDate',
        help: 'help.entryDate',
        formRef: 'Die Einreise in das Bundesgebiet erfolgte am: / Federal bölgeye (Almanya’ya) geliş tarihi:',
        required: true,
        visible: (v) => !v.entry.bornInGermany,
        format: zPastDate,
      },
      {
        name: 'entry.hadPreviousStays',
        type: 'yesNo',
        label: 'field.hadPreviousStays',
        help: 'help.previousStays',
        formRef: 'Voraufenthalte im Bundesgebiet / Ferderal bölgedeki (Almanya’daki) önceki ikametleri:',
        required: true,
      },
      {
        name: 'entry.previousStays',
        type: 'list',
        label: 'field.previousStays',
        itemLabel: 'field.previousStayItem',
        addLabel: 'action.addStay',
        max: MAX_PREVIOUS_STAYS,
        visible: (v) => v.entry.hadPreviousStays === 'yes',
        newItem: () => ({ ...emptyPreviousStay() }),
        itemFields: [
          {
            name: 'from',
            type: 'partialDate',
            label: 'field.stayFrom',
            formRef: 'von / Bu tarihten',
            required: true,
            format: zPartialPastDate,
            width: 'half',
          },
          {
            name: 'to',
            type: 'partialDate',
            label: 'field.stayTo',
            formRef: 'bis / Bu tarihe kadar',
            required: true,
            format: zPartialPastDate,
            width: 'half',
          },
          {
            name: 'place',
            type: 'text',
            label: 'field.stayPlace',
            formRef: 'in / İkamet edilen yer',
            required: true,
            format: zText(60),
            autoCapitalize: 'words',
          },
        ],
      },
    ],
  },
  {
    id: 'history',
    title: 'step.history.title',
    formSection: SEC_ENTRY,
    items: [
      {
        name: 'history.expelledOrRefused',
        type: 'yesNo',
        label: 'field.expelledOrRefused',
        help: 'help.expelledOrRefused',
        formRef:
          'Sind Sie aus Deutschland oder einem Schengen-Staat ausgewiesen, abgeschoben oder zurückgeschoben oder ist ein Antrag auf einen Aufenthaltstitel abgelehnt oder eine Einreise verweigert worden?',
        required: true,
      },
      {
        name: 'history.expelledWhen',
        type: 'partialDate',
        label: 'field.expelledWhen',
        formRef: 'Ja, wann / Evet ise, ne zaman',
        required: true,
        visible: (v) => v.history.expelledOrRefused === 'yes',
        format: zPartialPastDate,
      },
    ],
  },
  {
    id: 'stay',
    title: 'step.stay.title',
    formSection: SEC_ENTRY,
    items: [
      {
        name: 'stay.purpose',
        type: 'radio',
        label: 'field.purpose',
        help: 'help.purpose',
        formRef: 'Zweck des Aufenthaltes im Bundesgebiet: / Federal Bölgede ikamet amacınız:',
        options: PURPOSES,
        required: true,
      },
      {
        name: 'stay.purposeDetails',
        type: 'text',
        label: 'field.purposeDetails',
        help: 'help.purposeDetails',
        required: (v) => v.stay.purpose === 'other',
        visible: (v) => v.stay.purpose !== '',
        format: zText(70),
      },
      {
        name: 'stay.employerOrSchool',
        type: 'text',
        label: 'field.employerOrSchool',
        help: 'help.employerOrSchool',
        formRef: 'Arbeitgeber/Studienanstalt / İşveren / Eğitim kurumu:',
        format: zText(90),
      },
      {
        name: 'stay.livelihood',
        type: 'multi',
        label: 'field.livelihood',
        help: 'help.livelihood',
        formRef:
          'Aus welchen Mitteln wird der Lebensunterhalt bestritten? / Geçiminizi hangi imkanlarla sağlıyorsunuz?',
        options: LIVELIHOOD,
        required: true,
      },
      {
        name: 'stay.livelihoodOther',
        type: 'text',
        label: 'field.livelihoodOther',
        help: 'help.writeInGerman',
        required: true,
        visible: (v) => v.stay.livelihood.includes('other'),
        format: zText(60),
      },
    ],
  },
  {
    id: 'marital',
    title: 'step.marital.title',
    formSection: 'Familienstand / Medeni Hali',
    items: [
      {
        name: 'marital.status',
        type: 'radio',
        label: 'field.maritalStatus',
        formRef: 'Familienstand / Medeni Hali',
        options: MARITAL_STATUSES,
        required: true,
      },
      {
        name: 'marital.widowedSince',
        type: 'partialDate',
        label: 'field.widowedSince',
        formRef: 'verwitwet seit: / dul: … tarihinden beri',
        required: true,
        visible: (v) => v.marital.status === 'widowed',
        format: zPartialPastDate,
      },
    ],
  },
  {
    id: 'spouse',
    title: 'step.spouse.title',
    intro: 'step.spouse.intro',
    formSection: 'Angaben zum Ehegatten / Lebenspartner / Eşi / Hayat arkadaşı ile ilgili bilgiler',
    visible: hasSpouse,
    items: [
      {
        name: 'spouse.surname',
        type: 'text',
        label: 'field.surname',
        formRef: 'Name: / Soyadı:',
        required: true,
        format: zText(60),
        autoCapitalize: 'words',
        copyFrom: { path: 'applicant.surname', label: 'form.useMySurname' },
      },
      {
        name: 'spouse.birthName',
        type: 'text',
        label: 'field.birthName',
        help: 'help.birthName',
        formRef: 'Geburtsname: / Kızlık adı:',
        format: zText(60),
        autoCapitalize: 'words',
      },
      {
        name: 'spouse.givenNames',
        type: 'text',
        label: 'field.givenNames',
        formRef: 'Vorname: / Adı:',
        required: true,
        format: zText(60),
        autoCapitalize: 'words',
      },
      {
        name: 'spouse.birthDate',
        type: 'date',
        label: 'field.birthDate',
        formRef: 'Geburtsdatum und -ort: / Doğum tarihi ve yeri:',
        required: true,
        format: zPastDate,
      },
      {
        name: 'spouse.birthPlace',
        type: 'text',
        label: 'field.birthPlace',
        formRef: 'Geburtsdatum und -ort: / Doğum tarihi ve yeri:',
        required: true,
        format: zText(50),
        autoCapitalize: 'words',
      },
      {
        name: 'spouse.nationality',
        type: 'text',
        label: 'field.nationality',
        help: 'help.nationality',
        formRef: 'Staatsangehörigkeit: / Tabiiyeti:',
        required: true,
        format: zText(60),
        suggestions: NATIONALITY_SUGGESTIONS,
      },
      {
        name: 'spouse.sameAddress',
        type: 'checkbox',
        label: 'field.spouseSameAddress',
      },
      {
        name: 'spouse.address',
        type: 'text',
        label: 'field.spouseAddress',
        help: 'help.spouseAddress',
        formRef: 'Aktuelle Anschrift: /: Güncel ikamet adresi:',
        required: true,
        visible: (v) => !v.spouse.sameAddress,
        format: zText(110),
      },
    ],
  },
  {
    id: 'children',
    title: 'step.children.title',
    intro: 'step.children.intro',
    formSection: 'Kinder des Antragstellers / Dilekçe sahibinin çocukları',
    items: [
      {
        name: 'children.hasChildren',
        type: 'yesNo',
        label: 'field.hasChildren',
        required: true,
      },
      {
        name: 'children.list',
        type: 'list',
        label: 'field.childrenList',
        itemLabel: 'field.childItem',
        addLabel: 'action.addChild',
        max: MAX_CHILDREN,
        formRef: 'Kinder des Antragstellers / Dilekçe sahibinin çocukları',
        visible: (v) => v.children.hasChildren === 'yes',
        newItem: () => ({ ...emptyChild() }),
        itemFields: [
          {
            name: 'surname',
            type: 'text',
            label: 'field.surname',
            formRef: 'Name / Soyadı',
            required: true,
            format: zText(40),
            autoCapitalize: 'words',
            copyFrom: { path: 'applicant.surname', label: 'form.useMySurname' },
          },
          {
            name: 'givenNames',
            type: 'text',
            label: 'field.givenNames',
            formRef: 'Vorname / Adı',
            required: true,
            format: zText(40),
            autoCapitalize: 'words',
          },
          {
            name: 'birthDate',
            type: 'date',
            label: 'field.birthDate',
            formRef: 'Geburtstag -ort / Doğum tarihi ve yeri',
            required: true,
            format: zPastDate,
          },
          {
            name: 'birthPlace',
            type: 'text',
            label: 'field.birthPlace',
            formRef: 'Geburtstag -ort / Doğum tarihi ve yeri',
            required: true,
            format: zText(40),
            autoCapitalize: 'words',
          },
          {
            name: 'nationality',
            type: 'text',
            label: 'field.nationality',
            formRef: 'Staatsangehörigkeit / Tabiiyeti',
            required: true,
            format: zText(40),
            suggestions: NATIONALITY_SUGGESTIONS,
          },
          {
            name: 'residence',
            type: 'text',
            label: 'field.childResidence',
            help: 'help.childResidence',
            formRef: 'Wohnort / İkamet adresi',
            required: true,
            format: zText(50),
            autoCapitalize: 'words',
            copyFrom: { path: 'applicant.city', label: 'form.useMyCity' },
          },
        ],
      },
    ],
  },
  {
    id: 'parents',
    title: 'step.parents.title',
    intro: 'step.parents.intro',
    formSection: 'Eltern des Antragstellers / Dilekçe sahibinin anne ve babası',
    items: [
      {
        name: 'parents.father.unknown',
        type: 'checkbox',
        label: 'field.fatherUnknown',
        formRef: 'Vater (Name, Vorname, Geburtsdatum) / Babası (Soyadı, adı, doğum tarihi)',
      },
      {
        name: 'parents.father.surname',
        type: 'text',
        label: 'field.fatherSurname',
        required: true,
        visible: (v) => !v.parents.father.unknown,
        format: zText(50),
        autoCapitalize: 'words',
      },
      {
        name: 'parents.father.givenNames',
        type: 'text',
        label: 'field.fatherGivenNames',
        required: true,
        visible: (v) => !v.parents.father.unknown,
        format: zText(50),
        autoCapitalize: 'words',
      },
      {
        name: 'parents.father.birthDate',
        type: 'partialDate',
        label: 'field.fatherBirthDate',
        help: 'help.parentBirthDate',
        visible: (v) => !v.parents.father.unknown,
        format: zPartialPastDate,
      },
      {
        name: 'parents.mother.unknown',
        type: 'checkbox',
        label: 'field.motherUnknown',
        formRef: 'Mutter (Name, Vorname, Geburtsdatum) / Annesi (Soyadı, adı, doğum tarihi)',
      },
      {
        name: 'parents.mother.surname',
        type: 'text',
        label: 'field.motherSurname',
        required: true,
        visible: (v) => !v.parents.mother.unknown,
        format: zText(50),
        autoCapitalize: 'words',
      },
      {
        name: 'parents.mother.givenNames',
        type: 'text',
        label: 'field.motherGivenNames',
        required: true,
        visible: (v) => !v.parents.mother.unknown,
        format: zText(50),
        autoCapitalize: 'words',
      },
      {
        name: 'parents.mother.birthDate',
        type: 'partialDate',
        label: 'field.motherBirthDate',
        help: 'help.parentBirthDate',
        visible: (v) => !v.parents.mother.unknown,
        format: zPartialPastDate,
      },
    ],
  },
  {
    id: 'application',
    title: 'step.application.title',
    intro: 'step.application.intro',
    items: [
      {
        name: 'application.issueOrExtension',
        type: 'yesNo',
        label: 'field.issueOrExtension',
        help: 'help.issueOrExtension',
        formRef:
          'Ich beantrage die Erteilung / Verlängerung des Aufenthaltstitels / İkamet ünvanının verilmesini / uzatılmasını talep ediyorum',
        required: true,
      },
      {
        name: 'application.settlementPermit',
        type: 'yesNo',
        label: 'field.settlementPermit',
        help: 'help.settlementPermit',
        formRef:
          'Ich beantrage einen unbefristeten Aufenthaltstitel (Niederlassungserlaubnis) / Süresiz bir ikamet ünvanının (oturum izninin) verilmesini talep ediyorum',
        required: true,
      },
    ],
  },
];

export const isList = (item: StepItem): item is ListMeta => item.type === 'list';

export function isStepVisible(step: StepDef, v: FormValues): boolean {
  return step.visible ? step.visible(v) : true;
}

export function visibleSteps(v: FormValues): StepDef[] {
  return STEPS.filter((s) => isStepVisible(s, v));
}

export function isRequired(field: FieldMeta, v: FormValues): boolean {
  return typeof field.required === 'function' ? field.required(v) : Boolean(field.required);
}

/** Generic deep getter for dotted paths such as "children.list.2.surname". */
export function getPath(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const key of path.split('.')) {
    if (cur === null || cur === undefined) return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

/** All concrete (fully indexed) field paths of a step for the current values. */
export function stepFieldPaths(step: StepDef, v: FormValues): string[] {
  const paths: string[] = [];
  for (const item of step.items) {
    if (isList(item)) {
      paths.push(item.name);
      const rows = (getPath(v, item.name) as unknown[] | undefined) ?? [];
      rows.forEach((_, i) => item.itemFields.forEach((f) => paths.push(`${item.name}.${i}.${f.name}`)));
    } else {
      paths.push(item.name);
    }
  }
  return paths;
}
