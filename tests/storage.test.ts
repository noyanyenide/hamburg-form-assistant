// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  LS_LANGUAGE,
  LS_SAVE_ENABLED,
  clearStoredApplication,
  deleteAllData,
  loadDraft,
  loadSignature,
  saveDraft,
  saveSignature,
  writePreference,
} from '../src/storage/db';
import { sampleValues } from './helpers/sample';

describe('local storage of drafts', () => {
  beforeEach(async () => {
    await deleteAllData();
  });

  it('saves and restores the draft with its position', async () => {
    expect(await loadDraft()).toBeNull();
    await saveDraft({ values: sampleValues(), stepId: 'passport', furthestStep: 6 });
    const draft = await loadDraft();
    expect(draft?.values.applicant.surname).toBe('Yılmaz');
    expect(draft?.stepId).toBe('passport');
    expect(draft?.furthestStep).toBe(6);
    expect(Date.parse(draft!.updatedAt)).not.toBeNaN();
  });

  it('saves, replaces and removes the signature', async () => {
    await saveSignature(new Uint8Array([1, 2, 3]));
    expect(Array.from((await loadSignature())!)).toEqual([1, 2, 3]);
    await saveSignature(null);
    expect(await loadSignature()).toBeNull();
  });

  it('"start over" removes answers and signature', async () => {
    await saveDraft({ values: sampleValues(), stepId: 'passport', furthestStep: 1 });
    await saveSignature(new Uint8Array([9]));
    await clearStoredApplication();
    expect(await loadDraft()).toBeNull();
    expect(await loadSignature()).toBeNull();
  });

  it('"delete all my data" removes everything the app stored', async () => {
    await saveDraft({ values: sampleValues(), stepId: 'children', furthestStep: 10 });
    await saveSignature(new Uint8Array([7, 7]));
    writePreference(LS_LANGUAGE, 'tr');
    writePreference(LS_SAVE_ENABLED, '0');
    localStorage.setItem('unrelated', 'kept');

    await deleteAllData();

    // Check before reading again: reading would re-create an empty database.
    const names = (await indexedDB.databases()).map((d) => d.name);
    expect(names).not.toContain('hh-aufenthaltstitel-formularhilfe');
    expect(localStorage.getItem(LS_LANGUAGE)).toBeNull();
    expect(localStorage.getItem(LS_SAVE_ENABLED)).toBeNull();
    expect(localStorage.getItem('unrelated')).toBe('kept');
    expect(await loadDraft()).toBeNull();
    expect(await loadSignature()).toBeNull();
  });
});
