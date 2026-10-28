import { normalizeText } from '../pdf/charset';
import { hasSpouse } from './steps';
import { createEmptyForm, type FormValues } from './types';

/**
 * Returns the answers that actually apply: values belonging to questions that
 * are currently hidden (e.g. spouse details after switching to "single") are
 * blanked, and all text is normalised. The draft keeps the hidden values so
 * that switching back does not lose work, but they are never printed.
 */
export function effectiveValues(input: FormValues): FormValues {
  const v: FormValues = structuredClone(input);
  const empty = createEmptyForm();

  const normalizeDeep = (node: unknown): unknown => {
    if (typeof node === 'string') return normalizeText(node);
    if (Array.isArray(node)) return node.map(normalizeDeep);
    if (node && typeof node === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(node)) out[k] = normalizeDeep(val);
      return out;
    }
    return node;
  };
  const n = normalizeDeep(v) as FormValues;

  if (n.applicant.eyeColor !== 'other') n.applicant.eyeColorOther = '';
  if (n.entry.bornInGermany) n.entry.entryDate = '';
  if (n.entry.hadPreviousStays !== 'yes') n.entry.previousStays = [];
  if (n.history.expelledOrRefused !== 'yes') n.history.expelledWhen = '';
  if (n.stay.purpose === '') n.stay.purposeDetails = '';
  if (!n.stay.livelihood.includes('other')) n.stay.livelihoodOther = '';
  if (n.marital.status !== 'widowed') n.marital.widowedSince = '';
  if (!hasSpouse(n)) n.spouse = { ...empty.spouse };
  else if (n.spouse.sameAddress) n.spouse.address = '';
  if (n.children.hasChildren !== 'yes') n.children.list = [];
  for (const key of ['father', 'mother'] as const) {
    if (n.parents[key].unknown) n.parents[key] = { ...empty.parents[key], unknown: true };
  }
  return n;
}
