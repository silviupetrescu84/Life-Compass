import { values } from './values.data';

type SelectionListener = (selectedIds: ReadonlySet<string>) => void;
type SelectionStorage = Pick<Storage, 'getItem' | 'setItem'>;
export const MAX_CORE_VALUES = 6;
export const SELECTION_STORAGE_KEY = 'life-compass.selected-value-ids';
const validIds = new Set(values.map((value) => value.id));

function browserStorage(): SelectionStorage | undefined {
  try { return window.localStorage; } catch { return undefined; }
}

export function createValuesState(storage = browserStorage()) {
  const selectedIds = new Set<string>();
  const listeners = new Set<SelectionListener>();
  let persistenceAvailable = storage !== undefined;
  try {
    const saved: unknown = JSON.parse(storage?.getItem(SELECTION_STORAGE_KEY) ?? '[]');
    if (Array.isArray(saved)) {
      for (const id of saved) {
        if (typeof id === 'string' && validIds.has(id)) selectedIds.add(id);
      }
    }
  } catch { /* Invalid saved data starts an empty selection. */ }

  function persist(): void {
    try {
      storage?.setItem(SELECTION_STORAGE_KEY, JSON.stringify([...selectedIds]));
    } catch { persistenceAvailable = false; }
  }
  // Normalize outdated, duplicate, or malformed saved entries.
  persist();

  return {
    getSelectedIds(): ReadonlySet<string> { return new Set(selectedIds); },
    canContinue(): boolean { return selectedIds.size >= 1 && selectedIds.size <= MAX_CORE_VALUES; },
    isPersistenceAvailable(): boolean { return persistenceAvailable; },
    toggle(id: string): void {
      if (!validIds.has(id)) return;
      if (selectedIds.has(id)) selectedIds.delete(id);
      else selectedIds.add(id);
      persist();
      for (const listener of listeners) listener(new Set(selectedIds));
    },
    subscribe(listener: SelectionListener): () => void {
      listeners.add(listener);
      listener(new Set(selectedIds));
      return () => { listeners.delete(listener); };
    },
  };
}

export type ValuesState = ReturnType<typeof createValuesState>;
