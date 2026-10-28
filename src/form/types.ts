/**
 * The complete set of answers collected by the wizard. Every value is kept as
 * the user typed it (dates as "TT.MM.JJJJ"); formatting for the official form
 * happens in src/pdf/fieldMap.ts.
 */
export type YesNo = '' | 'yes' | 'no';

export type MaritalStatus = '' | 'single' | 'married' | 'partnership' | 'separated' | 'divorced' | 'widowed';

export interface PreviousStay {
  from: string;
  to: string;
  place: string;
}

export interface Child {
  surname: string;
  givenNames: string;
  birthDate: string;
  birthPlace: string;
  nationality: string;
  residence: string;
}

export interface Parent {
  unknown: boolean;
  surname: string;
  givenNames: string;
  birthDate: string;
}

export interface FormValues {
  applicant: {
    surname: string;
    birthName: string;
    givenNames: string;
    birthDate: string;
    birthPlace: string;
    nationality: string;
    street: string;
    houseNumber: string;
    addressAddition: string;
    postalCode: string;
    city: string;
    phone: string;
    email: string;
    eyeColor: string;
    eyeColorOther: string;
    heightCm: string;
  };
  passport: {
    number: string;
    issuePlace: string;
    issueDate: string;
    validUntil: string;
  };
  entry: {
    bornInGermany: boolean;
    entryDate: string;
    hadPreviousStays: YesNo;
    previousStays: PreviousStay[];
  };
  history: {
    expelledOrRefused: YesNo;
    expelledWhen: string;
  };
  stay: {
    purpose: string;
    purposeDetails: string;
    employerOrSchool: string;
    livelihood: string[];
    livelihoodOther: string;
  };
  marital: {
    status: MaritalStatus;
    widowedSince: string;
  };
  spouse: {
    surname: string;
    birthName: string;
    givenNames: string;
    birthDate: string;
    birthPlace: string;
    nationality: string;
    sameAddress: boolean;
    address: string;
  };
  children: {
    hasChildren: YesNo;
    list: Child[];
  };
  parents: {
    father: Parent;
    mother: Parent;
  };
  application: {
    issueOrExtension: YesNo;
    settlementPermit: YesNo;
  };
  signing: {
    declarationAccepted: boolean;
    date: string;
    signOnPaper: boolean;
  };
}

/** Number of rows printed on the official form. */
export const MAX_PREVIOUS_STAYS = 3;
export const MAX_CHILDREN = 6;

export const emptyPreviousStay = (): PreviousStay => ({ from: '', to: '', place: '' });

export const emptyChild = (): Child => ({
  surname: '',
  givenNames: '',
  birthDate: '',
  birthPlace: '',
  nationality: '',
  residence: '',
});

const emptyParent = (): Parent => ({ unknown: false, surname: '', givenNames: '', birthDate: '' });

export function createEmptyForm(): FormValues {
  return {
    applicant: {
      surname: '',
      birthName: '',
      givenNames: '',
      birthDate: '',
      birthPlace: '',
      nationality: '',
      street: '',
      houseNumber: '',
      addressAddition: '',
      postalCode: '',
      city: 'Hamburg',
      phone: '',
      email: '',
      eyeColor: '',
      eyeColorOther: '',
      heightCm: '',
    },
    passport: { number: '', issuePlace: '', issueDate: '', validUntil: '' },
    entry: { bornInGermany: false, entryDate: '', hadPreviousStays: '', previousStays: [] },
    history: { expelledOrRefused: '', expelledWhen: '' },
    stay: { purpose: '', purposeDetails: '', employerOrSchool: '', livelihood: [], livelihoodOther: '' },
    marital: { status: '', widowedSince: '' },
    spouse: {
      surname: '',
      birthName: '',
      givenNames: '',
      birthDate: '',
      birthPlace: '',
      nationality: '',
      sameAddress: true,
      address: '',
    },
    children: { hasChildren: '', list: [] },
    parents: { father: emptyParent(), mother: emptyParent() },
    application: { issueOrExtension: '', settlementPermit: '' },
    signing: { declarationAccepted: false, date: '', signOnPaper: false },
  };
}

/**
 * Merges a stored draft into a fresh empty form so that drafts saved by an
 * older version of the app (with fewer fields) still load safely.
 */
export function mergeWithDefaults(stored: unknown): FormValues {
  const base = createEmptyForm();
  if (!stored || typeof stored !== 'object') return base;
  const merge = (target: Record<string, unknown>, source: Record<string, unknown>) => {
    for (const key of Object.keys(target)) {
      const sv = source[key];
      const tv = target[key];
      if (sv === undefined || sv === null) continue;
      if (Array.isArray(tv)) {
        if (Array.isArray(sv)) target[key] = sv;
      } else if (typeof tv === 'object' && tv !== null) {
        if (typeof sv === 'object' && !Array.isArray(sv)) merge(tv as Record<string, unknown>, sv as Record<string, unknown>);
      } else if (typeof tv === typeof sv) {
        target[key] = sv;
      }
    }
  };
  merge(base as unknown as Record<string, unknown>, stored as Record<string, unknown>);
  base.entry.previousStays = base.entry.previousStays.slice(0, MAX_PREVIOUS_STAYS).map((s) => ({ ...emptyPreviousStay(), ...s }));
  base.children.list = base.children.list.slice(0, MAX_CHILDREN).map((c) => ({ ...emptyChild(), ...c }));
  return base;
}
