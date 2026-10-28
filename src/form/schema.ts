import { z } from 'zod';
import type { MessageKey } from '../i18n/types';
import { STEPS, getPath, isList, isRequired, isStepVisible, type FieldMeta, type StepDef, type StepId } from './steps';
import type { FormValues } from './types';
import { firstError, parseDate, parseDateRange, zPastDate } from './validators';

export interface Issue {
  path: string;
  message: MessageKey;
}

function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function checkField(field: FieldMeta, path: string, v: FormValues, issues: Issue[]): void {
  if (field.visible && !field.visible(v)) return;
  const value = getPath(v, path);
  if (isEmpty(value)) {
    if (isRequired(field, v)) {
      issues.push({ path, message: field.type === 'multi' ? 'err.selectAtLeastOne' : 'err.required' });
    }
    return;
  }
  if (field.format && typeof value === 'string') {
    const error = firstError(field.format, value.trim());
    if (error) issues.push({ path, message: error });
  }
}

function stepIssues(step: StepDef, v: FormValues): Issue[] {
  const issues: Issue[] = [];
  if (!isStepVisible(step, v)) return issues;
  for (const item of step.items) {
    if (isList(item)) {
      if (item.visible && !item.visible(v)) continue;
      const rows = (getPath(v, item.name) as unknown[] | undefined) ?? [];
      if (rows.length === 0) issues.push({ path: item.name, message: 'err.minOneEntry' });
      rows.forEach((_, i) => item.itemFields.forEach((f) => checkField(f, `${item.name}.${i}.${f.name}`, v, issues)));
    } else {
      checkField(item, item.name, v, issues);
    }
  }
  return issues;
}

/** Rules that compare several answers with each other. */
function crossFieldIssues(v: FormValues): Issue[] {
  const issues: Issue[] = [];
  const has = (path: string) => issues.some((i) => i.path === path);

  const issue = parseDate(v.passport.issueDate);
  const until = parseDate(v.passport.validUntil);
  if (issue && until && until <= issue) issues.push({ path: 'passport.validUntil', message: 'err.validUntilBeforeIssue' });

  const birth = parseDate(v.applicant.birthDate);
  const entry = parseDate(v.entry.entryDate);
  if (!v.entry.bornInGermany && birth && entry && entry < birth && !has('entry.entryDate')) {
    issues.push({ path: 'entry.entryDate', message: 'err.entryBeforeBirth' });
  }

  if (v.entry.hadPreviousStays === 'yes') {
    v.entry.previousStays.forEach((stay, i) => {
      const from = parseDateRange(stay.from);
      const to = parseDateRange(stay.to);
      if (from && to && to.end < from.start) issues.push({ path: `entry.previousStays.${i}.to`, message: 'err.toBeforeFrom' });
    });
  }
  return issues;
}

export interface CollectOptions {
  /** Restrict to these steps (default: all). */
  steps?: readonly StepId[];
  /** Include the declaration / date / signature rules of the signing screen. */
  includeSigning?: boolean;
}

export function collectIssues(v: FormValues, options: CollectOptions = {}): Issue[] {
  const steps = options.steps ? STEPS.filter((s) => options.steps!.includes(s.id)) : STEPS;
  const issues = steps.flatMap((s) => stepIssues(s, v));
  const seen = new Set(issues.map((i) => i.path));
  for (const extra of crossFieldIssues(v)) if (!seen.has(extra.path)) issues.push(extra);

  if (options.includeSigning) {
    if (!v.signing.declarationAccepted) issues.push({ path: 'signing.declarationAccepted', message: 'err.declaration' });
    // When signing on paper, the date may also be written by hand.
    if (isEmpty(v.signing.date)) {
      if (!v.signing.signOnPaper) issues.push({ path: 'signing.date', message: 'err.required' });
    } else {
      const error = firstError(zPastDate, v.signing.date.trim());
      if (error) issues.push({ path: 'signing.date', message: error });
    }
  }

  if (options.steps) {
    const allowed = new Set(options.steps);
    return issues.filter((i) => {
      if (i.path.startsWith('signing.')) return true;
      const owner = STEPS.find((s) => s.items.some((it) => i.path === it.name || i.path.startsWith(`${it.name}.`)));
      return owner ? allowed.has(owner.id) : true;
    });
  }
  return issues;
}

/**
 * Zod schema for React Hook Form. Field formats are Zod schemas declared in
 * steps.ts; requiredness and visibility depend on other answers and are
 * applied here, so a single schema validates the whole application.
 */
export const formSchema = z
  .custom<FormValues>((val) => typeof val === 'object' && val !== null)
  .superRefine((values, ctx) => {
    for (const issue of collectIssues(values, { includeSigning: true })) {
      ctx.addIssue({ code: 'custom', path: issue.path.split('.').map((p) => (/^\d+$/.test(p) ? Number(p) : p)), message: issue.message });
    }
  });

/** Steps that still contain errors (used by the review screen). */
export function stepsWithIssues(v: FormValues): Set<StepId> {
  const result = new Set<StepId>();
  for (const step of STEPS) {
    if (collectIssues(v, { steps: [step.id] }).some((i) => !i.path.startsWith('signing.'))) result.add(step.id);
  }
  return result;
}
