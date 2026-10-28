import { describe, expect, it } from 'vitest';
import { effectiveValues } from '../src/form/effective';
import { collectIssues, formSchema } from '../src/form/schema';
import { visibleSteps } from '../src/form/steps';
import { createEmptyForm, mergeWithDefaults } from '../src/form/types';
import { formatDate, parseDate, parseDateRange, todayString } from '../src/form/validators';
import { isSupportedChar, normalizeText, unsupportedChars } from '../src/pdf/charset';
import { sampleValues } from './helpers/sample';

const messagesFor = (path: string, v = createEmptyForm()) => collectIssues(v).filter((i) => i.path === path).map((i) => i.message);

describe('dates', () => {
  it('parses only real calendar dates', () => {
    expect(parseDate('29.02.2024')).not.toBeNull();
    expect(parseDate('29.02.2023')).toBeNull();
    expect(parseDate('31.04.2020')).toBeNull();
    expect(parseDate('1.2.2020')).toBeNull();
    expect(formatDate(parseDate('07.01.2001')!)).toBe('07.01.2001');
  });

  it('understands partial dates as ranges', () => {
    expect(parseDateRange('2015')).toEqual({ start: new Date(Date.UTC(2015, 0, 1)), end: new Date(Date.UTC(2015, 11, 31)) });
    expect(parseDateRange('02.2016')?.end).toEqual(new Date(Date.UTC(2016, 1, 29)));
    expect(parseDateRange('13.2016')).toBeNull();
  });

  it('formats today as TT.MM.JJJJ', () => {
    expect(todayString(new Date(2026, 9, 28))).toBe('28.10.2026');
  });
});

describe('charset', () => {
  it('accepts German and Turkish letters and rejects other scripts', () => {
    for (const ch of 'äöüÄÖÜßçÇğĞıİöÖşŞüÜéâ€–„“') expect(isSupportedChar(ch), ch).toBe(true);
    expect(unsupportedChars('Мария محمد 王')).toEqual(['М', 'а', 'р', 'и', 'я', 'م', 'ح', 'د', '王']);
  });

  it('normalises whitespace and Unicode composition', () => {
    expect(normalizeText('  Ayşe \n  Gül ')).toBe('Ayşe Gül');
  });
});

describe('validation rules', () => {
  it('accepts the complete sample application', () => {
    expect(collectIssues(sampleValues(), { includeSigning: true })).toEqual([]);
    expect(formSchema.safeParse(sampleValues()).success).toBe(true);
  });

  it('requires mandatory answers and reports them as i18n keys', () => {
    expect(messagesFor('applicant.surname')).toEqual(['err.required']);
    expect(messagesFor('applicant.birthName')).toEqual([]); // optional
    expect(messagesFor('stay.livelihood')).toEqual(['err.selectAtLeastOne']);
  });

  it('validates formats', () => {
    const v = sampleValues();
    v.applicant.postalCode = '2076';
    v.applicant.email = 'not-an-email';
    v.applicant.heightCm = '17';
    v.applicant.surname = 'Иванов';
    v.passport.validUntil = '01.01.2019';
    const issues = collectIssues(v);
    const byPath = Object.fromEntries(issues.map((i) => [i.path, i.message]));
    expect(byPath['applicant.postalCode']).toBe('err.postalCode');
    expect(byPath['applicant.email']).toBe('err.email');
    expect(byPath['applicant.heightCm']).toBe('err.height');
    expect(byPath['applicant.surname']).toBe('err.charset');
    expect(byPath['passport.validUntil']).toBe('err.validUntilBeforeIssue');
  });

  it('rejects future dates of birth and entries before birth', () => {
    const v = sampleValues();
    v.applicant.birthDate = '01.01.2999';
    expect(messagesFor('applicant.birthDate', v)).toEqual(['err.dateFuture']);
    const w = sampleValues();
    w.entry.entryDate = '01.01.1980';
    expect(messagesFor('entry.entryDate', w)).toEqual(['err.entryBeforeBirth']);
  });

  it('checks the order of previous stays', () => {
    const v = sampleValues();
    v.entry.previousStays[0] = { from: '2015', to: '2012', place: 'Köln' };
    expect(messagesFor('entry.previousStays.0.to', v)).toEqual(['err.toBeforeFrom']);
  });

  it('only validates questions that are shown', () => {
    const v = sampleValues();
    v.marital.status = 'single';
    v.spouse.surname = '';
    expect(messagesFor('spouse.surname', v)).toEqual([]);
    v.marital.status = 'married';
    expect(messagesFor('spouse.surname', v)).toEqual(['err.required']);
  });

  it('requires details for "other" answers', () => {
    const v = sampleValues();
    v.stay.purpose = 'other';
    v.stay.purposeDetails = '';
    expect(messagesFor('stay.purposeDetails', v)).toEqual(['err.required']);
    v.applicant.eyeColor = 'other';
    expect(messagesFor('applicant.eyeColorOther', v)).toEqual(['err.required']);
  });

  it('requires at least one entry in visible lists', () => {
    const v = sampleValues();
    v.children.list = [];
    expect(messagesFor('children.list', v)).toEqual(['err.minOneEntry']);
  });

  it('needs the declaration and (unless signing on paper) a date', () => {
    const v = sampleValues();
    v.signing = { declarationAccepted: false, date: '', signOnPaper: false };
    const signing = collectIssues(v, { includeSigning: true }).filter((i) => i.path.startsWith('signing.'));
    expect(signing.map((i) => i.message).sort()).toEqual(['err.declaration', 'err.required']);
    v.signing = { declarationAccepted: true, date: '', signOnPaper: true };
    expect(collectIssues(v, { includeSigning: true }).filter((i) => i.path.startsWith('signing.'))).toEqual([]);
  });

  it('can restrict validation to single steps', () => {
    const issues = collectIssues(createEmptyForm(), { steps: ['passport'] });
    expect(new Set(issues.map((i) => i.path.split('.')[0]))).toEqual(new Set(['passport']));
  });
});

describe('conditional steps and effective values', () => {
  it('shows the spouse step only for married, partnered or separated applicants', () => {
    const v = sampleValues();
    for (const [status, shown] of [['married', true], ['partnership', true], ['separated', true], ['single', false], ['divorced', false], ['widowed', false]] as const) {
      v.marital.status = status;
      expect(visibleSteps(v).some((s) => s.id === 'spouse'), status).toBe(shown);
    }
  });

  it('blanks answers to hidden questions', () => {
    const v = sampleValues();
    v.marital.status = 'divorced';
    v.history.expelledWhen = '2010';
    const e = effectiveValues(v);
    expect(e.spouse.surname).toBe('');
    expect(e.history.expelledWhen).toBe('');
    expect(v.spouse.surname).toBe('Yılmaz'); // the draft itself is untouched
  });
});

describe('draft migration', () => {
  it('fills missing fields of older drafts with defaults and drops unknown ones', () => {
    const merged = mergeWithDefaults({ applicant: { surname: 'Kaya', unexpected: 1 }, children: { list: [{ surname: 'Kaya' }] } });
    expect(merged.applicant.surname).toBe('Kaya');
    expect(merged.applicant.city).toBe('Hamburg');
    expect(merged.children.list[0]).toEqual({ surname: 'Kaya', givenNames: '', birthDate: '', birthPlace: '', nationality: '', residence: '' });
    expect('unexpected' in merged.applicant).toBe(false);
    expect(mergeWithDefaults(null)).toEqual(createEmptyForm());
  });
});
