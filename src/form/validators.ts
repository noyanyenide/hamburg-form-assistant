import { z } from 'zod';
import { unsupportedChars } from '../pdf/charset';
import type { MessageKey } from '../i18n/types';

/* ---------- Dates ("TT.MM.JJJJ", partial dates "MM.JJJJ" / "JJJJ") ---------- */

const FULL_DATE = /^(\d{2})\.(\d{2})\.(\d{4})$/;
const MONTH_YEAR = /^(\d{2})\.(\d{4})$/;
const YEAR = /^(\d{4})$/;

export function parseDate(value: string): Date | null {
  const m = FULL_DATE.exec(value.trim());
  if (!m) return null;
  const [day, month, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

/** Earliest and latest possible day described by a full or partial date. */
export function parseDateRange(value: string): { start: Date; end: Date } | null {
  const v = value.trim();
  const full = parseDate(v);
  if (full) return { start: full, end: full };
  let m = MONTH_YEAR.exec(v);
  if (m) {
    const month = Number(m[1]);
    const year = Number(m[2]);
    if (month < 1 || month > 12) return null;
    return { start: new Date(Date.UTC(year, month - 1, 1)), end: new Date(Date.UTC(year, month, 0)) };
  }
  m = YEAR.exec(v);
  if (m) {
    const year = Number(m[1]);
    return { start: new Date(Date.UTC(year, 0, 1)), end: new Date(Date.UTC(year, 11, 31)) };
  }
  return null;
}

export function todayUtc(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

export function formatDate(date: Date): string {
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${date.getUTCFullYear()}`;
}

export function todayString(now: Date = new Date()): string {
  return formatDate(todayUtc(now));
}

const MIN_YEAR = 1900;

/* ---------- Zod format schemas (error messages are i18n keys) ---------- */

const msg = (key: MessageKey) => ({ error: key });

export const zCharset = z.string().refine((v) => unsupportedChars(v).length === 0, msg('err.charset'));

export const zText = (max = 80) => zCharset.refine((v) => v.length <= max, msg('err.tooLong'));

export const zDate = z.string().refine((v) => parseDate(v) !== null, msg('err.date'));

export const zPastDate = zDate
  .refine((v) => (parseDate(v)?.getTime() ?? 0) <= todayUtc().getTime(), msg('err.dateFuture'))
  .refine((v) => (parseDate(v)?.getUTCFullYear() ?? MIN_YEAR) >= MIN_YEAR, msg('err.dateTooOld'));

/** Any valid calendar date from 1900 on (e.g. passport expiry, which may lie in the future). */
export const zAnyDate = zDate.refine(
  (v) => (parseDate(v)?.getTime() ?? 0) >= Date.UTC(MIN_YEAR, 0, 1),
  msg('err.dateTooOld'),
);

export const zPartialPastDate = z
  .string()
  .refine((v) => parseDateRange(v) !== null, msg('err.partialDate'))
  .refine((v) => (parseDateRange(v)?.start.getTime() ?? 0) <= todayUtc().getTime(), msg('err.dateFuture'))
  .refine((v) => (parseDateRange(v)?.start.getUTCFullYear() ?? MIN_YEAR) >= MIN_YEAR, msg('err.dateTooOld'));

export const zPostalCode = z.string().regex(/^\d{5}$/, msg('err.postalCode'));

export const zEmail = z.string().max(80, msg('err.tooLong')).pipe(z.email(msg('err.email')));

export const zPhone = z.string().regex(/^\+?[0-9 ()/-]{5,25}$/, msg('err.phone'));

export const zHeight = z
  .string()
  .regex(/^\d{2,3}$/, msg('err.height'))
  .refine((v) => Number(v) >= 50 && Number(v) <= 250, msg('err.height'));

export const zPassportNumber = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9 -]{3,19}$/, msg('err.passportNumber'));

/** Returns the first error key produced by a schema, or null when valid. */
export function firstError(schema: z.ZodType, value: unknown): MessageKey | null {
  const result = schema.safeParse(value);
  if (result.success) return null;
  return (result.error.issues[0]?.message ?? 'err.invalid') as MessageKey;
}
