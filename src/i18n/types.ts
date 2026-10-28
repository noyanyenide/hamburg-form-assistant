export type { MessageKey } from './en';
import type { MessageKey } from './en';

export type Dictionary = Record<MessageKey, string>;

export const LANGUAGES = ['tr', 'de', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

export const isLanguage = (value: unknown): value is Language =>
  typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
