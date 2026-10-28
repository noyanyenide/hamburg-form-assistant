import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { LS_LANGUAGE, readPreference, writePreference } from '../storage/db';
import { de } from './de';
import { en } from './en';
import { tr } from './tr';
import { isLanguage, type Dictionary, type Language, type MessageKey } from './types';

export const DICTIONARIES: Record<Language, Dictionary> = { tr, de, en };

export type Translate = (key: MessageKey, params?: Record<string, string | number>) => string;

export function translate(language: Language, key: MessageKey, params?: Record<string, string | number>): string {
  const template = DICTIONARIES[language][key] ?? en[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

interface I18nContextValue {
  /** null until the user has picked a language. */
  language: Language | null;
  setLanguage: (language: Language) => void;
  /** Forget the choice in memory (storage is cleared by deleteAllData). */
  resetLanguage: () => void;
  t: Translate;
  locale: string;
}

const LOCALES: Record<Language, string> = { tr: 'tr-TR', de: 'de-DE', en: 'en-GB' };

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language | null>(() => {
    const stored = readPreference(LS_LANGUAGE);
    return isLanguage(stored) ? stored : null;
  });

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    writePreference(LS_LANGUAGE, next);
  }, []);

  const resetLanguage = useCallback(() => setLanguageState(null), []);

  const active: Language = language ?? 'de';

  useEffect(() => {
    document.documentElement.lang = active;
    document.title = translate(active, 'app.name');
  }, [active]);

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      setLanguage,
      resetLanguage,
      t: (key, params) => translate(active, key, params),
      locale: LOCALES[active],
    }),
    [language, setLanguage, resetLanguage, active],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}
