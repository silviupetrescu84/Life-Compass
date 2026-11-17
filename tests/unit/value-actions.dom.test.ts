// @vitest-environment happy-dom
import { expect, test } from 'vitest';
import { createValueNotes, DEFAULT_NOTE, MAX_ACTIONS, type ValueAction } from '../../src/features/values/values.notes';
import { noteSaveButton } from '../support/app';
import { mountCompass, mountNotesForm, value } from '../support/compass';
import { $, $$, text, type } from '../support/dom';
import { useFakeLayout } from '../support/fake-layout';
import { memoryStorage, savedNotes } from '../support/storage';

useFakeLayout();

/** The notes form for one value, with helpers to drive its list of small actions. */
function mountActions(actions: readonly ValueAction[] = []) {
  const notes = createValueNotes(memoryStorage());
  notes.edit('love', { ...DEFAULT_NOTE, actions });
  const { form, onEdit } = mountNotesForm(notes);
  form.show(value('love'));
  const root = form.element;
  const newAction = $<HTMLInputElement>(root, '#value-action-new');
  return {
    notes,
    onEdit,
    root,
    newAction,
    addButton: $<HTMLButtonElement>(root, '.value-actions__add button'),
    add: (action: string) => {
      type(newAction, action);
      $(root, '.value-actions__add button').click();
    },
    rows: () => $$(root, '.value-action'),
    texts: () => $$<HTMLInputElement>(root, '.value-action__text').map((input) => input.value),
    field: (index: number) => $$<HTMLInputElement>(root, '.value-action__text')[index]!,
    checkbox: (index: number) => $$<HTMLInputElement>(root, '.value-action input[type="checkbox"]')[index]!,
    deleteButton: (index: number) => $$(root, '.value-action button')[index]!,
    count: () => text(root, '.value-actions__count'),
  };
}

test('actions are added with the Add button or Enter, ignoring blanks, up to 10 per value', () => {
  const { notes, onEdit, root, newAction, addButton, add, texts, count } = mountActions();
  expect(text(root, '.value-actions h3')).toBe('Small actions');
  expect(text(root, '#value-actions-hint')).toBe('Up to 10 small steps that help you live Love.');
  expect(text(root, 'label[for="value-action-new"]')).toBe('New action');
  expect(count()).toBe('0 of 10 actions');

  add('  Call my sister  ');
  expect(texts(), 'text is trimmed').toStrictEqual(['Call my sister']);
  expect(notes.get('love').actions).toStrictEqual([{ text: 'Call my sister', done: false }]);
  expect(onEdit).toHaveBeenCalledTimes(1);
  expect(newAction.value, 'ready for the next action').toBe('');
  expect(document.activeElement).toBe(newAction);

  type(newAction, 'Cook for a friend');
  $<HTMLFormElement>(root, '.value-actions__add').requestSubmit();
  expect(texts(), 'Enter submits the form too').toStrictEqual(['Call my sister', 'Cook for a friend']);
  add('   ');
  expect(texts(), 'blank actions are ignored').toHaveLength(2);
  expect(count()).toBe('2 of 10 actions');

  for (let step = 3; step <= MAX_ACTIONS; step++) add(`Step ${step}`);
  expect(texts()).toHaveLength(MAX_ACTIONS);
  expect([newAction.disabled, addButton.disabled]).toStrictEqual([true, true]);
  expect(count()).toBe('10 of 10 actions. Delete one to add another.');
  // Even if the form were submitted anyway, an eleventh action is not added.
  newAction.disabled = false;
  type(newAction, 'One too many');
  $<HTMLFormElement>(root, '.value-actions__add').requestSubmit();
  expect(notes.get('love').actions).toHaveLength(MAX_ACTIONS);
});

test('actions can be edited, completed, and deleted, and are never left empty', () => {
  const actions = ['Call my sister', 'Cook for a friend', 'Write a letter'].map((action) => ({
    text: action,
    done: false,
  }));
  const { notes, rows, texts, field, checkbox, deleteButton, newAction, count } = mountActions(actions);
  expect(field(1).getAttribute('aria-label')).toBe('Action 2');
  expect(checkbox(1).getAttribute('aria-label')).toBe('Done: Cook for a friend');
  expect(deleteButton(1).getAttribute('aria-label')).toBe('Delete: Cook for a friend');

  /** The action's field, its stored text, and the labels that name it all agree. */
  const expectAction = (index: number, action: string) => {
    expect(field(index).value).toBe(action);
    expect(notes.get('love').actions[index]?.text).toBe(action);
    expect(checkbox(index).getAttribute('aria-label')).toBe(`Done: ${action}`);
    expect(deleteButton(index).getAttribute('aria-label')).toBe(`Delete: ${action}`);
  };
  type(field(1), 'Cook dinner for a friend');
  expectAction(1, 'Cook dinner for a friend');
  field(1).dispatchEvent(new Event('change'));
  type(field(1), '   ');
  field(1).dispatchEvent(new Event('change'));
  // An action left empty gets its text back; use Delete to remove one.
  expectAction(1, 'Cook dinner for a friend');

  checkbox(0).click();
  expect(notes.get('love').actions[0]).toStrictEqual({ text: 'Call my sister', done: true });
  expect(rows()[0]?.classList.contains('is-done')).toBe(true);
  checkbox(0).click();
  expect(notes.get('love').actions[0]?.done).toBe(false);
  expect(rows()[0]?.classList.contains('is-done')).toBe(false);

  deleteButton(1).click();
  expect(texts()).toStrictEqual(['Call my sister', 'Write a letter']);
  expect(document.activeElement, 'focus moves to the next action').toBe(field(1));
  expect(field(1).getAttribute('aria-label'), 'rows are renumbered').toBe('Action 2');
  deleteButton(1).click();
  expect(document.activeElement, 'or to the one before').toBe(field(0));
  deleteButton(0).click();
  expect(document.activeElement, 'or to adding a new one').toBe(newAction);
  expect(notes.get('love').actions).toStrictEqual([]);
  expect(count()).toBe('0 of 10 actions');
});

test('actions follow the value shown, stay unsaved across values, and save with the one Save button', () => {
  const storage = memoryStorage();
  const { root, button, notes } = mountCompass(['love', 'trust'], storage);
  const add = (action: string) => {
    type($<HTMLInputElement>(root, '#value-action-new'), action);
    $(root, '.value-actions__add button').click();
  };
  const texts = () => $$<HTMLInputElement>(root, '.value-action__text').map((input) => input.value);
  button('Love').click();
  add('Call my sister');
  button('Trust').click();
  expect(texts(), 'each value has its own actions').toStrictEqual([]);
  add('Keep a promise');
  button('Love').click();
  expect(texts(), 'unsaved actions survive switching').toStrictEqual(['Call my sister']);
  expect(text(root, '.compass-save [role="status"]')).toBe('Unsaved changes to Love and Trust.');

  noteSaveButton(root).click();
  expect(savedNotes(storage).love?.actions).toStrictEqual([{ text: 'Call my sister', done: false }]);
  expect(notes.unsavedIds().size).toBe(0);
  $<HTMLInputElement>(root, '.value-action input[type="checkbox"]').click();
  expect(text(root, '.compass-save [role="status"]'), 'completing one needs saving too').toBe(
    'Unsaved changes to Love.',
  );

  document.body.replaceChildren();
  const reloaded = mountCompass(['love', 'trust'], storage);
  reloaded.button('Trust').click();
  expect($<HTMLInputElement>(reloaded.root, '.value-action__text').value, 'saved actions come back').toBe(
    'Keep a promise',
  );
});
