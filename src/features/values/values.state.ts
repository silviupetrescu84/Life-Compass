type SelectionListener = (selectedIds: ReadonlySet<string>) => void;

export const MAX_SELECTED_VALUES = 6;

export function createValuesState() {
  const selectedIds = new Set<string>();
  const listeners = new Set<SelectionListener>();

  return {
    getSelectedIds(): ReadonlySet<string> {
      return new Set(selectedIds);
    },
    toggle(id: string): void {
      if (selectedIds.has(id)) selectedIds.delete(id);
      else if (selectedIds.size < MAX_SELECTED_VALUES) selectedIds.add(id);
      else return;
      // Give subscribers a snapshot so consumers cannot mutate internal state.
      for (const listener of listeners) listener(new Set(selectedIds));
    },
    subscribe(listener: SelectionListener): () => void {
      listeners.add(listener);
      listener(new Set(selectedIds));
      return () => { listeners.delete(listener); };
    },
  };
}
