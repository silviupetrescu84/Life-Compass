import { browserStorage, createJsonStorage } from '../../shared/storage.ts';
import { NOTES_STORAGE_KEY } from '../../shared/compass-data.ts';
import { isValueId } from './values.data.ts';

export { NOTES_STORAGE_KEY };
// Generous for personal writing while keeping every note well within localStorage quotas.
export const MAX_NOTE_LENGTH = 5000;
export const NOTE_FIELDS = ['definition', 'reflection'] as const;
export const RATINGS = [1, 2, 3, 4, 5] as const;
export const MAX_RATING = RATINGS.length;
/** Every value starts at this rating until the user changes it. */
export const DEFAULT_RATING = 3;
/** Each value can have up to this many small actions. */
export const MAX_ACTIONS = 10;
export const MAX_ACTION_LENGTH = 200;
export type NoteField = (typeof NOTE_FIELDS)[number];
export type Rating = (typeof RATINGS)[number];
export interface ValueAction {
  readonly text: string;
  readonly done: boolean;
}
export type ValueNote = Readonly<Record<NoteField, string> & { rating: Rating; actions: readonly ValueAction[] }>;

/** A value nobody has written about, rated, or planned for yet. Notes equal to this are not stored. */
export const DEFAULT_NOTE: ValueNote = Object.freeze({
  definition: '',
  reflection: '',
  rating: DEFAULT_RATING,
  actions: Object.freeze([]),
});

/** A whole number from 1 to MAX_RATING is a rating; anything else falls back to the default. */
export function toRating(value: unknown): Rating {
  return (RATINGS as readonly unknown[]).includes(value) ? (value as Rating) : DEFAULT_RATING;
}

function sameNote(a: ValueNote, b: ValueNote): boolean {
  return (
    NOTE_FIELDS.every((field) => a[field] === b[field]) &&
    a.rating === b.rating &&
    a.actions.length === b.actions.length &&
    a.actions.every((action, index) => action.text === b.actions[index]?.text && action.done === b.actions[index].done)
  );
}

// Keeps well-formed actions, up to the limit, with their text capped.
function toActions(input: unknown): readonly ValueAction[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter(
      (action: Partial<Record<keyof ValueAction, unknown>> | null): action is ValueAction =>
        typeof action?.text === 'string' && typeof action.done === 'boolean',
    )
    .slice(0, MAX_ACTIONS)
    .map(({ text, done }) => ({ text: text.slice(0, MAX_ACTION_LENGTH), done }));
}

// Turns saved or edited data into a valid note: text is capped, invalid parts become empty.
export function toNote(input: unknown): ValueNote {
  const entry: Partial<Record<keyof ValueNote, unknown>> = typeof input === 'object' && input !== null ? input : {};
  const note = { ...DEFAULT_NOTE };
  for (const field of NOTE_FIELDS) {
    const text = entry[field];
    if (typeof text === 'string') note[field] = text.slice(0, MAX_NOTE_LENGTH);
  }
  return { ...note, rating: toRating(entry.rating), actions: toActions(entry.actions) };
}

// Notes are keyed by value ID and kept when a value leaves the compass,
// so re-choosing it later brings back what the user wrote.
// Edits stay in memory as drafts until save() writes all of them at once.
export function createValueNotes(storage = browserStorage()) {
  const store = createJsonStorage(storage);
  const saved = new Map<string, ValueNote>();
  const drafts = new Map<string, ValueNote>();
  const data = store.read(NOTES_STORAGE_KEY);
  if (typeof data === 'object' && data !== null) {
    for (const [id, entry] of Object.entries(data)) {
      const note = toNote(entry);
      if (isValueId(id) && !sameNote(note, DEFAULT_NOTE)) saved.set(id, note);
    }
  }

  function persist(): void {
    if (saved.size === 0) store.remove(NOTES_STORAGE_KEY);
    else store.write(NOTES_STORAGE_KEY, Object.fromEntries(saved));
  }
  // Normalize outdated IDs and malformed entries, and detect unavailable storage early.
  persist();

  const savedNote = (id: string): ValueNote => saved.get(id) ?? DEFAULT_NOTE;

  return {
    /** The note as the user currently sees it, including unsaved edits. */
    get: (id: string): ValueNote => drafts.get(id) ?? savedNote(id),
    /** Records an unsaved edit. Editing back to the saved note leaves nothing to save. */
    edit(id: string, note: ValueNote): void {
      if (!isValueId(id)) return;
      const next = toNote(note);
      if (sameNote(next, savedNote(id))) drafts.delete(id);
      else drafts.set(id, next);
    },
    unsavedIds: (): ReadonlySet<string> => new Set(drafts.keys()),
    /** Saves every unsaved edit in one storage write; notes back at the default are removed. */
    save(): void {
      for (const [id, note] of drafts) {
        if (sameNote(note, DEFAULT_NOTE)) saved.delete(id);
        else saved.set(id, note);
      }
      drafts.clear();
      persist();
    },
    clear(): void {
      saved.clear();
      drafts.clear();
      store.remove(NOTES_STORAGE_KEY);
    },
    isPersistenceAvailable: store.isAvailable,
  };
}

export type ValueNotes = ReturnType<typeof createValueNotes>;
