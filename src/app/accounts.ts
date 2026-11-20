import {
  COMPASS_STORAGE_KEYS,
  CORE_STORAGE_KEY,
  NOTES_STORAGE_KEY,
  SELECTION_STORAGE_KEY,
  type AccountSession,
  type CompassChanges,
  type CompassData,
  type CompassStorageKey,
  type NoteChanges,
} from '../shared/compass-data';

export async function accountRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api/${path}`, options).catch(() => {
    throw new Error('Could not connect to Life Compass. Try again.');
  });
  if (!response.ok) {
    const { error } = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(error ?? 'Life Compass could not complete the request. Try again.');
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function combineNotes(previous: NoteChanges | undefined, next: NoteChanges): NoteChanges {
  if (!previous || next.clear) return next;
  return { clear: previous.clear, entries: { ...previous.entries, ...next.entries } };
}

export function createAccountStorage(
  session: AccountSession,
  onStatus: (state: 'saving' | 'saved' | 'failed', error?: unknown) => void,
) {
  const data: CompassData = { ...session.data };
  const headers = { 'Content-Type': 'application/json', 'X-Life-Compass-Account': String(session.accountId) };
  let pending: CompassChanges = {};
  let saving: Promise<boolean> | undefined;

  async function flush(): Promise<boolean> {
    while (Object.keys(pending).length) {
      const batch = pending;
      pending = {};
      onStatus('saving');
      try {
        await accountRequest('compass', { method: 'PUT', headers, body: JSON.stringify(batch) });
      } catch (error) {
        const newerNotes = pending[NOTES_STORAGE_KEY];
        pending = { ...batch, ...pending };
        if (newerNotes) pending[NOTES_STORAGE_KEY] = combineNotes(batch[NOTES_STORAGE_KEY], newerNotes);
        onStatus('failed', error);
        return false;
      }
    }
    onStatus('saved');
    return true;
  }

  function selectionChanged(): void {
    // Selection and confirmation belong to the same update, including when either is cleared.
    pending[SELECTION_STORAGE_KEY] = data[SELECTION_STORAGE_KEY] ?? null;
    pending[CORE_STORAGE_KEY] = data[CORE_STORAGE_KEY] ?? null;
  }

  function stageNotes(value: string | undefined): void {
    const previous = JSON.parse(data[NOTES_STORAGE_KEY] ?? '{}') as Record<string, unknown>;
    const next = JSON.parse(value ?? '{}') as Record<string, unknown>;
    const entries = Object.fromEntries(
      [...new Set([...Object.keys(previous), ...Object.keys(next)])]
        .filter((id) => JSON.stringify(previous[id]) !== JSON.stringify(next[id]))
        .map((id) => [id, next[id] ?? null]),
    );
    if (Object.keys(entries).length) pending[NOTES_STORAGE_KEY] = combineNotes(pending[NOTES_STORAGE_KEY], { entries });
  }

  return {
    storage: {
      getItem: (key: string): string | null => data[key as CompassStorageKey] ?? null,
      setItem(key: string, value: string): void {
        if (!COMPASS_STORAGE_KEYS.includes(key as CompassStorageKey)) return;
        const storageKey = key as CompassStorageKey;
        if (storageKey === NOTES_STORAGE_KEY) stageNotes(value);
        data[storageKey] = value;
        if (storageKey !== NOTES_STORAGE_KEY) selectionChanged();
      },
      removeItem(key: string): void {
        if (!COMPASS_STORAGE_KEYS.includes(key as CompassStorageKey)) return;
        const storageKey = key as CompassStorageKey;
        if (storageKey === NOTES_STORAGE_KEY) stageNotes(undefined);
        delete data[storageKey];
        if (storageKey !== NOTES_STORAGE_KEY) selectionChanged();
      },
    },
    clearNotes(): void {
      pending[NOTES_STORAGE_KEY] = { clear: true, entries: {} };
    },
    discardInitializationWrites(): void {
      pending = {};
    },
    save(): Promise<boolean> {
      saving ??= Promise.resolve()
        .then(flush)
        .finally(() => {
          saving = undefined;
        });
      return saving;
    },
    hasPendingChanges: () => Boolean(saving) || Object.keys(pending).length > 0,
    logout: () => accountRequest<void>('logout', { method: 'POST', headers }),
  };
}
