import { expect, test, vi } from 'vitest';
import {
  createValueNotes,
  DEFAULT_NOTE,
  DEFAULT_RATING,
  MAX_ACTION_LENGTH,
  MAX_ACTIONS,
  MAX_NOTE_LENGTH,
  NOTES_STORAGE_KEY,
  NOTE_FIELDS,
  RATINGS,
  toRating,
  type ValueNote,
} from '../../src/features/values/values.notes';
import { isValueId } from '../../src/features/values/values.data';
import type { KeyValueStorage } from '../../src/shared/storage';
import { blockedStorage, memoryStorage, savedNotes } from '../support/storage';

const note = (changes: Partial<ValueNote>): ValueNote => ({ ...DEFAULT_NOTE, ...changes });

// Storage that also holds data from elsewhere, which notes must never touch.
function sharedStorage() {
  const storage = memoryStorage({ 'unrelated-key': 'keep' });
  return { storage, notes: createValueNotes(storage) };
}

function expectOnlyNotesRemoved(storage: KeyValueStorage): void {
  expect(storage.getItem(NOTES_STORAGE_KEY)).toBe(null);
  expect(storage.getItem('unrelated-key')).toBe('keep');
}

test('ratings, definitions, and reflections are saved per value and restored after reload', () => {
  const storage = memoryStorage();
  const notes = createValueNotes(storage);
  expect(NOTE_FIELDS).toStrictEqual(['definition', 'reflection']);
  expect(RATINGS).toStrictEqual([1, 2, 3, 4, 5]);
  expect(notes.get('love')).toStrictEqual(DEFAULT_NOTE);
  expect(storage.getItem(NOTES_STORAGE_KEY), 'nothing is written until the user saves').toBe(null);

  const love = note({ definition: 'Choosing care, even when it is hard.', reflection: 'Sunday calls.', rating: 4 });
  notes.edit('love', love);
  notes.edit('trust', note({ rating: 2 }));
  notes.save();
  expect(savedNotes(storage)).toStrictEqual({ love, trust: note({ rating: 2 }) });

  const restored = createValueNotes(storage);
  expect(restored.get('love')).toStrictEqual(love);
  expect(restored.get('trust')).toStrictEqual(note({ rating: 2 }));
  expect(restored.isPersistenceAvailable()).toBe(true);
});

test('every value starts at a rating of 3, and a note is only stored once it differs from that', () => {
  const storage = memoryStorage();
  const notes = createValueNotes(storage);
  expect(DEFAULT_RATING).toBe(3);
  expect(notes.get('love')).toStrictEqual({ definition: '', reflection: '', rating: 3, actions: [] });

  notes.edit('love', note({ rating: 3 }));
  expect(notes.unsavedIds().size, 'choosing the default changes nothing').toBe(0);
  notes.edit('love', note({ rating: 4 }));
  notes.save();
  expect(savedNotes(storage), 'a rating alone is worth keeping').toStrictEqual({ love: note({ rating: 4 }) });
  notes.edit('love', note({ rating: 3 }));
  notes.save();
  expect(storage.getItem(NOTES_STORAGE_KEY), 'back at the default, nothing is stored').toBe(null);

  for (const rating of RATINGS) expect(toRating(rating)).toBe(rating);
  for (const invalid of [0, 6, 2.5, '3', null, undefined]) expect(toRating(invalid), String(invalid)).toBe(3);
});

test('small actions are saved with the note, up to 10 per value, and completing one is a change', () => {
  const storage = memoryStorage();
  const notes = createValueNotes(storage);
  const many = Array.from({ length: 12 }, (_, index) => ({ text: `Step ${index + 1}`, done: false }));
  notes.edit('love', note({ actions: many }));
  expect(notes.get('love').actions, 'at most 10 per value').toStrictEqual(many.slice(0, MAX_ACTIONS));
  notes.edit('love', note({ actions: [{ text: 'x'.repeat(MAX_ACTION_LENGTH + 5), done: true }] }));
  expect(notes.get('love').actions[0]?.text.length).toBe(MAX_ACTION_LENGTH);

  const actions = [
    { text: 'Call my sister', done: false },
    { text: 'Cook for a friend', done: true },
  ];
  notes.edit('love', note({ actions }));
  notes.save();
  expect(savedNotes(storage).love, 'a note with only actions is kept').toStrictEqual(note({ actions }));
  expect(createValueNotes(storage).get('love').actions).toStrictEqual(actions);

  const completed = [{ ...actions[0]!, done: true }, actions[1]!];
  notes.edit('love', note({ actions: completed }));
  expect(notes.unsavedIds(), 'completing an action is a change').toStrictEqual(new Set(['love']));
  notes.edit('love', note({ actions }));
  expect(notes.unsavedIds().size, 'undoing it is not').toBe(0);
  notes.edit('love', note({ actions: [actions[0]!] }));
  expect(notes.unsavedIds().size, 'deleting one is a change').toBe(1);

  notes.edit('love', note({ actions: [] }));
  notes.save();
  expect(storage.getItem(NOTES_STORAGE_KEY), 'with every action deleted, nothing is left to store').toBe(null);
});

test('malformed saved actions are dropped', () => {
  const storage = memoryStorage({
    [NOTES_STORAGE_KEY]: JSON.stringify({
      love: { actions: 'not a list' },
      trust: {
        actions: [null, 'text', { text: 'Keep promises', done: false }, { text: 4, done: true }, { text: 'No state' }],
      },
    }),
  });
  const notes = createValueNotes(storage);
  expect(notes.get('love').actions).toStrictEqual([]);
  expect(notes.get('trust').actions).toStrictEqual([{ text: 'Keep promises', done: false }]);
});

test('edits stay unsaved, across values, until save writes them all at once', () => {
  const storage = memoryStorage();
  const notes = createValueNotes(storage);
  const writes = vi.spyOn(storage, 'setItem');
  notes.edit('love', note({ definition: 'Care' }));
  notes.edit('trust', note({ rating: 5 }));
  notes.edit('honesty', note({ reflection: 'Say it kindly' }));
  expect(notes.get('love'), 'edits are visible before saving').toStrictEqual(note({ definition: 'Care' }));
  expect(notes.unsavedIds()).toStrictEqual(new Set(['love', 'trust', 'honesty']));
  expect(writes).not.toHaveBeenCalled();
  expect(createValueNotes(storage).get('love'), 'a reload before saving loses edits').toStrictEqual(DEFAULT_NOTE);

  notes.save();
  expect(writes, 'one storage write for every value').toHaveBeenCalledTimes(1);
  expect(Object.keys(savedNotes(storage))).toStrictEqual(['love', 'trust', 'honesty']);
  expect(notes.unsavedIds().size).toBe(0);
});

test('editing back to the saved note leaves nothing to save', () => {
  const notes = createValueNotes(memoryStorage());
  notes.edit('love', note({ definition: 'Care', rating: 3 }));
  notes.save();
  notes.edit('love', note({ definition: 'Care, daily', rating: 3 }));
  expect(notes.unsavedIds()).toStrictEqual(new Set(['love']));
  notes.edit('love', note({ definition: 'Care', rating: 3 }));
  expect(notes.unsavedIds().size).toBe(0);
  expect(notes.get('love')).toStrictEqual(note({ definition: 'Care', rating: 3 }));
});

test('user text is kept exactly as written, up to the length limit', () => {
  const storage = memoryStorage();
  const notes = createValueNotes(storage);
  const text = '  Line one\n\n  <b>Line two</b> & "quotes" 🌱  ';
  notes.edit('love', note({ definition: text, reflection: 'x'.repeat(MAX_NOTE_LENGTH + 10) }));
  expect(notes.get('love').reflection.length).toBe(MAX_NOTE_LENGTH);
  notes.save();
  expect(createValueNotes(storage).get('love').definition).toBe(text);
  expect(savedNotes(storage).love?.reflection.length).toBe(MAX_NOTE_LENGTH);
});

test('saving an empty note removes it, and the last removal clears the storage key', () => {
  const { storage, notes } = sharedStorage();
  notes.edit('love', note({ definition: 'Care', rating: 1 }));
  notes.edit('trust', note({ rating: 5 }));
  notes.save();
  notes.edit('love', DEFAULT_NOTE);
  notes.save();
  expect(Object.keys(savedNotes(storage))).toStrictEqual(['trust']);
  notes.edit('trust', DEFAULT_NOTE);
  notes.save();
  expectOnlyNotesRemoved(storage);
});

test('unknown value IDs are ignored', () => {
  const storage = memoryStorage();
  const notes = createValueNotes(storage);
  expect(isValueId('outdated-id')).toBe(false);
  notes.edit('outdated-id', note({ definition: 'Ignored', rating: 2 }));
  expect(notes.get('outdated-id')).toStrictEqual(DEFAULT_NOTE);
  expect(notes.unsavedIds().size).toBe(0);
  notes.save();
  expect(storage.getItem(NOTES_STORAGE_KEY)).toBe(null);
});

test('clear removes every saved and unsaved note, and only the notes key', () => {
  const { storage, notes } = sharedStorage();
  const ids = ['courage', 'honesty'];
  for (const id of ids) notes.edit(id, note({ reflection: `Living ${id}`, rating: 3 }));
  notes.save();
  notes.edit('love', note({ rating: 5 }));
  notes.clear();
  expectOnlyNotesRemoved(storage);
  expect(notes.unsavedIds().size).toBe(0);
  const reloaded = createValueNotes(storage);
  for (const id of [...ids, 'love']) {
    expect(notes.get(id)).toStrictEqual(DEFAULT_NOTE);
    expect(reloaded.get(id)).toStrictEqual(DEFAULT_NOTE);
  }
});

test('malformed, outdated, or out-of-range saved notes are ignored and normalized', () => {
  for (const raw of ['{broken', 'null', '"text"', '42', '[]', '[{"definition":"x"}]']) {
    const storage = memoryStorage({ [NOTES_STORAGE_KEY]: raw });
    expect(createValueNotes(storage).get('love'), raw).toStrictEqual(DEFAULT_NOTE);
    expect(storage.getItem(NOTES_STORAGE_KEY), raw).toBe(null);
  }
  // Written as raw JSON because an object literal would treat __proto__ as the prototype.
  const storage = memoryStorage({
    [NOTES_STORAGE_KEY]: `{
      "love": { "definition": "Care", "reflection": 7, "extra": "dropped" },
      "trust": "not an object",
      "honesty": null,
      "courage": { "definition": "", "reflection": "", "rating": null },
      "outdated-id": { "definition": "Gone", "rating": 3 },
      "__proto__": { "definition": "Not a value" },
      "kindness": { "reflection": "${'y'.repeat(MAX_NOTE_LENGTH + 1)}", "rating": 5 },
      "gratitude": { "rating": 0 },
      "patience": { "rating": 6 },
      "humility": { "rating": 2.5 },
      "curiosity": { "rating": "3" },
      "joy": { "rating": 1 }
    }`,
  });
  const notes = createValueNotes(storage);
  expect('definition' in {}, 'saved data cannot pollute object prototypes').toBe(false);
  expect(notes.get('love'), 'notes saved before ratings existed still load').toStrictEqual(
    note({ definition: 'Care' }),
  );
  expect(notes.get('kindness').reflection.length).toBe(MAX_NOTE_LENGTH);
  expect(notes.get('kindness').rating).toBe(5);
  expect(notes.get('joy').rating).toBe(1);
  for (const id of ['courage', 'gratitude', 'patience', 'humility', 'curiosity']) {
    expect(notes.get(id).rating, `${id}: missing or invalid ratings start at 3`).toBe(3);
  }
  expect(Object.keys(savedNotes(storage)), 'invalid ratings alone do not make a note').toStrictEqual([
    'love',
    'kindness',
    'joy',
  ]);
  expect(savedNotes(storage).love).toStrictEqual(note({ definition: 'Care' }));
});

test('notes keep working in memory when storage is unavailable', () => {
  // `undefined` falls back to browserStorage(), which finds no `window` in Node.
  for (const storage of [blockedStorage(), undefined]) {
    const notes = createValueNotes(storage);
    notes.edit('love', note({ definition: 'Still here', rating: 4 }));
    notes.save();
    expect(notes.get('love')).toStrictEqual(note({ definition: 'Still here', rating: 4 }));
    expect(notes.isPersistenceAvailable()).toBe(false);
    notes.clear();
    expect(notes.get('love')).toStrictEqual(DEFAULT_NOTE);
  }
});
