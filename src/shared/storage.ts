export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function browserStorage(): KeyValueStorage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

// Blocked storage, quota errors, and malformed JSON never break the app:
// failures mark persistence unavailable so the UI can explain that data is kept for this visit only.
export function createJsonStorage(storage: KeyValueStorage | undefined) {
  let available = storage !== undefined;

  function attempt<T>(action: (target: KeyValueStorage) => T): T | undefined {
    if (!storage) return undefined;
    try {
      return action(storage);
    } catch {
      available = false;
      return undefined;
    }
  }

  return {
    read(key: string): unknown {
      const text = attempt((target) => target.getItem(key));
      if (typeof text !== 'string') return undefined;
      try {
        return JSON.parse(text);
      } catch {
        return undefined;
      }
    },
    write(key: string, value: unknown): void {
      attempt((target) => target.setItem(key, JSON.stringify(value)));
    },
    remove(key: string): void {
      attempt((target) => target.removeItem(key));
    },
    // An arrow function, so stores can expose it directly without binding.
    isAvailable: (): boolean => available,
  };
}

export function persistenceNote(available: boolean, subject: string): string {
  return available
    ? 'Saved on this device. You can change these later.'
    : `Storage unavailable. Your ${subject} will last for this visit only.`;
}
