import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { FormValues } from '../form/types';

/**
 * Local persistence. Personal data (answers, signature) lives only in this
 * IndexedDB database on the user's device. Two non-personal preferences
 * (interface language, "save on this device") live in localStorage so they
 * can be read synchronously at start-up. deleteAllData() removes all of it.
 */
const DB_NAME = 'hh-aufenthaltstitel-formularhilfe';
const DB_VERSION = 1;
const STORE = 'kv';

export const LS_LANGUAGE = 'hh-ae.language';
export const LS_SAVE_ENABLED = 'hh-ae.saveEnabled';
const OWN_LOCAL_STORAGE_KEYS = [LS_LANGUAGE, LS_SAVE_ENABLED];

export const DRAFT_VERSION = 1;

export interface StoredDraft {
  version: number;
  values: FormValues;
  stepId: string;
  furthestStep: number;
  updatedAt: string;
}

export interface StoredSignature {
  png: ArrayBuffer;
  updatedAt: string;
}

interface Schema extends DBSchema {
  kv: {
    key: 'draft' | 'signature';
    value: StoredDraft | StoredSignature;
  };
}

let dbPromise: Promise<IDBPDatabase<Schema>> | null = null;

function db(): Promise<IDBPDatabase<Schema>> {
  if (!dbPromise) {
    dbPromise = openDB<Schema>(DB_NAME, DB_VERSION, {
      upgrade(database) {
        if (!database.objectStoreNames.contains(STORE)) database.createObjectStore(STORE);
      },
      blocking() {
        // Another tab wants to delete/upgrade the database: let it.
        void closeDb();
      },
    }).catch((error: unknown) => {
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}

async function closeDb(): Promise<void> {
  if (!dbPromise) return;
  const pending = dbPromise;
  dbPromise = null;
  try {
    (await pending).close();
  } catch {
    /* already closed or never opened */
  }
}

export async function loadDraft(): Promise<StoredDraft | null> {
  const value = (await (await db()).get(STORE, 'draft')) as StoredDraft | undefined;
  if (!value || typeof value !== 'object' || !('values' in value)) return null;
  return value;
}

export async function saveDraft(draft: Omit<StoredDraft, 'version' | 'updatedAt'>): Promise<StoredDraft> {
  const record: StoredDraft = { ...draft, version: DRAFT_VERSION, updatedAt: new Date().toISOString() };
  await (await db()).put(STORE, record, 'draft');
  return record;
}

export async function loadSignature(): Promise<Uint8Array | null> {
  const value = (await (await db()).get(STORE, 'signature')) as StoredSignature | undefined;
  if (!value?.png) return null;
  return new Uint8Array(value.png);
}

export async function saveSignature(png: Uint8Array | null): Promise<void> {
  const database = await db();
  if (!png) {
    await database.delete(STORE, 'signature');
    return;
  }
  const copy = png.slice().buffer as ArrayBuffer;
  await database.put(STORE, { png: copy, updatedAt: new Date().toISOString() }, 'signature');
}

/** Removes stored answers and signature but keeps preferences. */
export async function clearStoredApplication(): Promise<void> {
  const database = await db();
  await database.clear(STORE);
}

function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    // "blocked" only means a connection (ours finishing its last transaction, or
    // another tab) is still closing; deletion then completes on its own. The
    // contents were already cleared, so don't wait forever.
    const timer = setTimeout(resolve, 3000);
    request.onsuccess = () => {
      clearTimeout(timer);
      resolve();
    };
    request.onerror = () => {
      clearTimeout(timer);
      reject(request.error ?? new Error('deleteDatabase failed'));
    };
  });
}

/**
 * Deletes everything this app stored on the device: the IndexedDB database
 * (answers, signature) and the app's own localStorage keys.
 */
export async function deleteAllData(): Promise<void> {
  const errors: unknown[] = [];
  try {
    const database = await db();
    await database.clear(STORE);
  } catch (error) {
    errors.push(error);
  }
  await closeDb();
  try {
    await deleteDatabase();
  } catch (error) {
    errors.push(error);
  }
  try {
    for (const key of OWN_LOCAL_STORAGE_KEYS) localStorage.removeItem(key);
  } catch (error) {
    errors.push(error);
  }
  if (errors.length > 0) throw new Error('Some data could not be deleted');
}

/* ---------- Preferences (non-personal, synchronous) ---------- */

export function readPreference(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writePreference(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable (private mode) – preference is simply not remembered */
  }
}

/** Ask the browser not to evict our storage under pressure (best effort). */
export async function requestPersistentStorage(): Promise<void> {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch {
    /* not supported */
  }
}
