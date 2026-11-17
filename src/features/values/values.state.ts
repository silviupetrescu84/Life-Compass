import { createJsonStorage, browserStorage } from '../../shared/storage';
import { isValueId } from './values.data';

type SelectionListener = (selectedIds: ReadonlySet<string>) => void;
/** Users continue to their compass with exactly this many values. */
export const CORE_VALUE_COUNT = 6;
export const SELECTION_STORAGE_KEY = 'life-compass.selected-value-ids';
export const CORE_STORAGE_KEY = 'life-compass.core-value-ids';

export function createValuesState(storage = browserStorage()) {
  const store = createJsonStorage(storage);
  const selectedIds = new Set<string>();
  const listeners = new Set<SelectionListener>();
  const saved = store.read(SELECTION_STORAGE_KEY);
  if (Array.isArray(saved)) {
    for (const id of saved) if (isValueId(id)) selectedIds.add(id);
  }
  const savedCore = store.read(CORE_STORAGE_KEY);
  // A saved compass is restored only if it still matches a complete selection.
  let hasCoreValues =
    Array.isArray(savedCore) &&
    savedCore.length === CORE_VALUE_COUNT &&
    selectedIds.size === CORE_VALUE_COUNT &&
    new Set(savedCore).size === savedCore.length &&
    savedCore.every((id: unknown) => typeof id === 'string' && selectedIds.has(id));

  function canContinue(): boolean {
    return selectedIds.size === CORE_VALUE_COUNT;
  }
  function persist(): void {
    store.write(SELECTION_STORAGE_KEY, [...selectedIds]);
  }
  function notify(): void {
    for (const listener of listeners) listener(new Set(selectedIds));
  }
  // Normalize outdated, duplicate, or malformed saved entries.
  persist();

  return {
    getSelectedIds(): ReadonlySet<string> {
      return new Set(selectedIds);
    },
    canContinue,
    hasCoreValues(): boolean {
      return hasCoreValues;
    },
    confirmCoreValues(): boolean {
      if (!canContinue()) return false;
      hasCoreValues = true;
      store.write(CORE_STORAGE_KEY, [...selectedIds]);
      return true;
    },
    reset(): void {
      selectedIds.clear();
      hasCoreValues = false;
      store.remove(SELECTION_STORAGE_KEY);
      store.remove(CORE_STORAGE_KEY);
      notify();
    },
    isPersistenceAvailable: store.isAvailable,
    toggle(id: string): void {
      if (!isValueId(id)) return;
      if (selectedIds.has(id)) selectedIds.delete(id);
      else selectedIds.add(id);
      hasCoreValues = false;
      store.remove(CORE_STORAGE_KEY);
      persist();
      notify();
    },
    subscribe(listener: SelectionListener): void {
      listeners.add(listener);
      listener(new Set(selectedIds));
    },
  };
}
