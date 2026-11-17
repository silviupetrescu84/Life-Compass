import { vi } from 'vitest';
import { createCompassScreen } from '../../src/features/compass/CompassScreen';
import { createValueNotesForm } from '../../src/features/compass/ValueNotesForm';
import { values } from '../../src/features/values/values.data';
import { createValueNotes, type ValueNotes } from '../../src/features/values/values.notes';
import type { Value } from '../../src/features/values/values.types';
import type { KeyValueStorage } from '../../src/shared/storage';
import { $, $$, required, text } from './dom';
import { memoryStorage } from './storage';

export const value = (id: string): Value =>
  required(
    values.find((item) => item.id === id),
    `value ${id}`,
  );

/** Mounts the compass screen with the given values, backed by its own notes store. */
export function mountCompass(ids: readonly string[], storage: KeyValueStorage = memoryStorage()) {
  const calls = { explore: 0, reset: 0 };
  const notes = createValueNotes(storage);
  const compass = createCompassScreen(
    notes,
    () => calls.explore++,
    () => calls.reset++,
  );
  document.body.append(compass.element);
  compass.element.hidden = false;
  compass.render(ids.map(value));
  const root = compass.element;
  const findButton = (name: string) =>
    $$<HTMLButtonElement>(root, '.compass-value').find((item) => item.textContent === name);
  return {
    compass,
    notes,
    root,
    calls,
    findButton,
    button: (name: string) => required(findButton(name), `compass button ${name}`),
    detail: () => [text(root, '.compass-detail h2'), text(root, '.compass-detail [role="status"] p')],
    pressed: () => $$(root, '.compass-value[aria-pressed="true"]').map((item) => item.textContent),
    form: $(root, '.value-notes'),
  };
}

/** Mounts the notes form on its own, recording each time it reports an edit. */
export function mountNotesForm(notes: ValueNotes) {
  const onEdit = vi.fn();
  const form = createValueNotesForm(notes, onEdit);
  document.body.append(form.element);
  return { form, onEdit };
}
