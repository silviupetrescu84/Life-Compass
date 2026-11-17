import { NOTES_STORAGE_KEY, type ValueNote } from '../../src/features/values/values.notes';
import type { KeyValueStorage } from '../../src/shared/storage';
import { required } from './dom';

export interface MemoryStorage extends KeyValueStorage {
  /** When true, writes fail the way they do in a browser whose storage quota is used up. */
  full: boolean;
}

export function memoryStorage(entries: Record<string, string> = {}): MemoryStorage {
  const saved = new Map(Object.entries(entries));
  const storage: MemoryStorage = {
    full: false,
    getItem: (key) => saved.get(key) ?? null,
    setItem: (key, value) => {
      if (storage.full) throw new DOMException('Storage is full', 'QuotaExceededError');
      saved.set(key, String(value));
    },
    removeItem: (key) => {
      saved.delete(key);
    },
  };
  return storage;
}

export function blockedStorage(): KeyValueStorage {
  const fail = (): never => {
    throw new DOMException('Storage blocked', 'SecurityError');
  };
  return { getItem: fail, setItem: fail, removeItem: fail };
}

export function readJson<T>(storage: KeyValueStorage, key: string): T {
  return JSON.parse(required(storage.getItem(key), `saved ${key}`)) as T;
}

/** The notes written to storage, keyed by value ID. */
export const savedNotes = (storage: KeyValueStorage) => readJson<Record<string, ValueNote>>(storage, NOTES_STORAGE_KEY);
