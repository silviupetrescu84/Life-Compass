import { persistenceNote } from '../../shared/storage';
import { values } from '../values/values.data';
import type { ValueNotes } from '../values/values.notes';

const list = new Intl.ListFormat('en', { type: 'conjunction' });

// One Save button for every value's rating and notes, with a status line that names
// the values with unsaved changes, then confirms the save or explains storage problems.
export function createNotesSaveBar(notes: ValueNotes) {
  const element = document.createElement('div');
  element.className = 'compass-save';
  const save = document.createElement('button');
  save.type = 'button';
  save.className = 'primary-button';
  save.textContent = 'Save';
  const status = document.createElement('p');
  status.className = 'storage-note';
  status.setAttribute('role', 'status');
  element.append(save, status);
  let justSaved = false;

  // Only write on change so screen readers announce each new state once, not every keystroke.
  function update(): void {
    const available = notes.isPersistenceAvailable();
    const unsaved = notes.unsavedIds();
    let text = available ? '' : persistenceNote(false, 'notes');
    if (unsaved.size > 0) {
      const names = values.filter((value) => unsaved.has(value.id)).map((value) => value.name);
      text = `Unsaved changes to ${list.format(names)}.`;
    } else if (justSaved) text = persistenceNote(available, 'notes');
    if (status.textContent !== text) status.textContent = text;
  }

  save.addEventListener('click', () => {
    notes.save();
    justSaved = true;
    update();
  });

  return {
    element,
    /** Updates the status after edits or when the compass is shown again. */
    refresh(): void {
      justSaved = false;
      update();
    },
  };
}
