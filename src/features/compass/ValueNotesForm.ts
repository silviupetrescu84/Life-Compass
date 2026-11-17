import { MAX_NOTE_LENGTH, NOTE_FIELDS, type NoteField, type ValueNote, type ValueNotes } from '../values/values.notes';
import { createActionList } from './ValueActionList';
import type { Value } from '../values/values.types';

const FIELD_COPY: Record<NoteField, { label: (name: string) => string; hint: string }> = {
  definition: {
    label: (name) => `What ${name} means to me`,
    hint: 'A sentence or two is enough. There are no wrong answers.',
  },
  reflection: {
    label: () => 'My reflection',
    hint: 'How does this value show up in your life today? Where would you like it to guide you?',
  },
};

// Edits one value's definition, reflection, and small actions. Every change is kept as an unsaved
// edit in the notes store, so switching values never loses what was entered; the Save bar saves
// them. Ratings are set on the compass graph.
export function createValueNotesForm(notes: ValueNotes, onEdit: () => void) {
  const element = document.createElement('div');
  element.className = 'value-notes';
  element.hidden = true;
  let activeId: string | null = null;

  const heading = document.createElement('h3');
  heading.textContent = 'In your own words';
  element.append(heading);

  const fields = NOTE_FIELDS.map((field) => {
    const id = `value-note-${field}`;
    const label = document.createElement('label');
    label.htmlFor = id;
    const hint = document.createElement('p');
    hint.id = `${id}-hint`;
    hint.className = 'value-notes__hint';
    hint.textContent = FIELD_COPY[field].hint;
    const input = document.createElement('textarea');
    input.id = id;
    input.rows = 4;
    input.maxLength = MAX_NOTE_LENGTH;
    input.setAttribute('aria-describedby', hint.id);
    input.addEventListener('input', () => recordEdit({ [field]: input.value }));
    element.append(label, hint, input);
    return { field, label, input };
  });

  function recordEdit(changes: Partial<ValueNote>): void {
    if (activeId === null) return;
    notes.edit(activeId, { ...notes.get(activeId), ...changes });
    onEdit();
  }

  const actionList = createActionList((actions) => recordEdit({ actions }));
  element.append(actionList.element);

  return {
    element,
    show(value: Value | null): void {
      activeId = value?.id ?? null;
      element.hidden = value === null;
      if (value === null) return;
      const note = notes.get(value.id);
      for (const { field, label, input } of fields) {
        label.textContent = FIELD_COPY[field].label(value.name);
        input.value = note[field];
      }
      actionList.show(note.actions, value.name);
    },
  };
}
