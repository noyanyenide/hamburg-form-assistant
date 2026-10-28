import { describe, expect, it } from 'vitest';
import { DICTIONARIES, translate } from '../src/i18n';
import { en } from '../src/i18n/en';
import { LANGUAGES } from '../src/i18n/types';
import { EYE_COLORS, LIVELIHOOD, MARITAL_STATUSES, PURPOSES } from '../src/form/options';
import { STEPS, isList } from '../src/form/steps';

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('translations', () => {
  it('cover exactly the same keys in Turkish, German and English', () => {
    const keys = Object.keys(en).sort();
    for (const lang of LANGUAGES) expect(Object.keys(DICTIONARIES[lang]).sort(), lang).toEqual(keys);
  });

  it('have no empty texts and consistent placeholders', () => {
    for (const lang of LANGUAGES) {
      for (const [key, value] of Object.entries(DICTIONARIES[lang])) {
        expect(value.trim(), `${lang}:${key}`).not.toBe('');
        expect(placeholders(value), `${lang}:${key}`).toEqual(placeholders(en[key as keyof typeof en]));
      }
    }
  });

  it('translate every label used by the wizard', () => {
    const keys = new Set<string>();
    for (const step of STEPS) {
      keys.add(step.title);
      if (step.intro) keys.add(step.intro);
      for (const item of step.items) {
        keys.add(item.label);
        const fields = isList(item) ? [...item.itemFields] : [item];
        if (isList(item)) {
          keys.add(item.itemLabel);
          keys.add(item.addLabel);
        }
        for (const f of fields) {
          keys.add(f.label);
          if (f.help) keys.add(f.help);
          if (f.copyFrom) keys.add(f.copyFrom.label);
        }
      }
    }
    for (const o of [...EYE_COLORS, ...PURPOSES, ...LIVELIHOOD, ...MARITAL_STATUSES]) keys.add(o.label);
    for (const key of keys) expect(key in en, key).toBe(true);
  });

  it('substitutes parameters', () => {
    expect(translate('tr', 'nav.stepOf', { current: 2, total: 13 })).toBe('Adım 2 / 13');
    expect(translate('de', 'nav.stepOf', { current: 2, total: 13 })).toBe('Schritt 2 von 13');
  });
});
