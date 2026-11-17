import { expect, test, vi } from 'vitest';
import { browserStorage, createJsonStorage, persistenceNote } from '../../src/shared/storage';
import { countValues } from '../../src/shared/text';
import { blockedStorage, memoryStorage } from '../support/storage';

test('browserStorage uses localStorage and falls back when it is inaccessible', () => {
  const localStorage = memoryStorage();
  vi.stubGlobal('window', { localStorage });
  expect(browserStorage()).toBe(localStorage);
  vi.stubGlobal('window', {
    get localStorage() {
      throw new DOMException('Access denied', 'SecurityError');
    },
  });
  expect(browserStorage()).toBe(undefined);
  vi.stubGlobal('window', undefined);
  expect(browserStorage()).toBe(undefined);
});

test('JSON storage round-trips values and treats missing or malformed entries as absent', () => {
  const storage = memoryStorage({ broken: '{not json' });
  const store = createJsonStorage(storage);
  expect(store.read('missing')).toBe(undefined);
  expect(store.read('broken')).toBe(undefined);
  store.write('notes', { love: { definition: 'Showing up' } });
  expect(storage.getItem('notes')).toBe('{"love":{"definition":"Showing up"}}');
  expect(store.read('notes')).toStrictEqual({ love: { definition: 'Showing up' } });
  store.remove('notes');
  expect(store.read('notes')).toBe(undefined);
  expect(store.isAvailable(), 'malformed data is not a storage failure').toBe(true);
});

test('JSON storage reports unavailable, blocked, or full storage without throwing', () => {
  const missing = createJsonStorage(undefined);
  expect(missing.isAvailable()).toBe(false);
  missing.write('key', 1);
  missing.remove('key');
  expect(missing.read('key')).toBe(undefined);

  const blocked = createJsonStorage(blockedStorage());
  expect(blocked.isAvailable()).toBe(true);
  expect(blocked.read('key')).toBe(undefined);
  expect(blocked.isAvailable()).toBe(false);

  const full = memoryStorage();
  full.full = true;
  const quota = createJsonStorage(full);
  quota.remove('key');
  expect(quota.isAvailable()).toBe(true);
  quota.write('key', 'too much');
  expect(quota.isAvailable()).toBe(false);
});

test('persistence notes and value counts use consistent wording', () => {
  expect(persistenceNote(true, 'notes')).toBe('Saved on this device. You can change these later.');
  expect(persistenceNote(false, 'notes')).toBe('Storage unavailable. Your notes will last for this visit only.');
  expect(countValues(0)).toBe('0 values');
  expect(countValues(1)).toBe('1 value');
  expect(countValues(120)).toBe('120 values');
});
