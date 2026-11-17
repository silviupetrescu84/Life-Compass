// @vitest-environment happy-dom
import { expect, test } from 'vitest';
import { getCompassLayout, pointOnCircle } from '../../src/features/compass/compass.layout';
import {
  createValueNotes,
  DEFAULT_NOTE,
  MAX_RATING,
  MAX_NOTE_LENGTH,
  NOTES_STORAGE_KEY,
  type NoteField,
} from '../../src/features/values/values.notes';
import { values } from '../../src/features/values/values.data';
import type { KeyValueStorage } from '../../src/shared/storage';
import { $, $$, press, required, text, type } from '../support/dom';
import { noteField as field, noteSaveButton, rate, ratingHandle, ratingOf, SIX_VALUES } from '../support/app';
import { mountCompass, mountNotesForm, value } from '../support/compass';
import { useFakeLayout } from '../support/fake-layout';
import { blockedStorage, memoryStorage, savedNotes } from '../support/storage';

const layout = useFakeLayout();
/** Presses the compass Save button and returns what was written to storage. */
function pressSave(root: ParentNode, storage: KeyValueStorage) {
  noteSaveButton(root).click();
  return savedNotes(storage);
}
const labelFor = (root: ParentNode, name: NoteField) => text(root, `label[for="value-note-${name}"]`);
const status = (root: ParentNode) => $(root, '.compass-save [role="status"]');
const SAVED = 'Saved on this device. You can change these later.';
const UNAVAILABLE = 'Storage unavailable. Your notes will last for this visit only.';

test("the notes form shows each value's notes and keeps edits when switching values", () => {
  const storage = memoryStorage();
  const notes = createValueNotes(storage);
  const { form, onEdit } = mountNotesForm(notes);
  expect(form.element.hidden).toBe(true);

  form.show(value('love'));
  expect(form.element.hidden).toBe(false);
  expect(form.element.querySelector('[role="slider"]'), 'ratings are set on the compass, not here').toBe(null);
  expect(labelFor(form.element, 'definition')).toBe('What Love means to me');
  expect(labelFor(form.element, 'reflection')).toBe('My reflection');
  for (const name of ['definition', 'reflection'] as const) {
    const input = field(form.element, name);
    expect(input.value).toBe('');
    expect(input.maxLength).toBe(MAX_NOTE_LENGTH);
    expect(text(document, `#${input.getAttribute('aria-describedby')}`), `${name} has a hint`).not.toBe('');
  }
  expect(
    $$(form.element, 'button').map((button) => button.textContent),
    'no Save inside a value',
  ).not.toContain('Save');

  notes.edit('love', { ...DEFAULT_NOTE, rating: 4 });
  type(field(form.element, 'definition'), 'Choosing care.');
  expect(notes.get('love'), 'typing keeps the rating').toStrictEqual({
    ...DEFAULT_NOTE,
    definition: 'Choosing care.',
    rating: 4,
  });
  expect(onEdit).toHaveBeenCalledTimes(1);
  expect(storage.getItem(NOTES_STORAGE_KEY), 'editing alone saves nothing').toBe(null);

  form.show(value('trust'));
  expect(labelFor(form.element, 'definition')).toBe('What Trust means to me');
  expect(field(form.element, 'definition').value).toBe('');
  type(field(form.element, 'reflection'), 'Keeping promises.');

  form.show(value('love'));
  expect(field(form.element, 'definition').value, 'unsaved edits survive switching').toBe('Choosing care.');
  form.show(value('trust'));
  expect(field(form.element, 'reflection').value).toBe('Keeping promises.');
  expect(notes.unsavedIds()).toStrictEqual(new Set(['love', 'trust']));

  form.show(null);
  expect(form.element.hidden).toBe(true);
  onEdit.mockClear();
  type(field(form.element, 'definition'), 'Not recorded anywhere');
  expect(onEdit, 'a hidden form records nothing').not.toHaveBeenCalled();
  expect(notes.get('trust').definition).toBe('');
});

test('one Save outside the values saves every change and says what is unsaved', () => {
  const storage = memoryStorage();
  const { root, button, form } = mountCompass(['love', 'trust', 'honesty'], storage);
  const saveBar = $(root, '.compass-save');
  expect(form.contains(saveBar) || $(root, '.compass-detail').contains(saveBar), 'Save is outside each value').toBe(
    false,
  );
  expect(noteSaveButton(root).textContent).toBe('Save');
  expect(status(root).textContent).toBe('');

  rate(root, 'Trust', 5);
  button('Love').click();
  type(field(root, 'definition'), 'Care in action');
  expect(status(root).textContent, 'values listed in compass order').toBe('Unsaved changes to Love and Trust.');
  button('Honesty').click();
  type(field(root, 'reflection'), 'Say it kindly');
  expect(status(root).textContent).toBe('Unsaved changes to Love, Trust, and Honesty.');
  expect(storage.getItem(NOTES_STORAGE_KEY)).toBe(null);

  expect(pressSave(root, storage)).toStrictEqual({
    love: { ...DEFAULT_NOTE, definition: 'Care in action' },
    trust: { ...DEFAULT_NOTE, rating: 5 },
    honesty: { ...DEFAULT_NOTE, reflection: 'Say it kindly' },
  });
  expect(status(root).textContent).toBe(SAVED);
  button('Love').click();
  expect(status(root).textContent, 'the saved message stays while nothing changes').toBe(SAVED);

  type(field(root, 'definition'), 'Care, daily');
  expect(status(root).textContent).toBe('Unsaved changes to Love.');
  type(field(root, 'definition'), 'Care in action');
  expect(status(root).textContent, 'back to the saved text').toBe('');
  noteSaveButton(root).click();
  expect(status(root).textContent, 'saving with no changes still confirms').toBe(SAVED);
});

test('the Save status is announced once per change and explains storage problems', () => {
  const storage = memoryStorage();
  const { root, button } = mountCompass(['love'], storage);
  button('Love').click();
  type(field(root, 'definition'), 'C');
  const announcement = status(root).firstChild;
  type(field(root, 'definition'), 'Care');
  expect(status(root).firstChild, 'unchanged status text is not rewritten').toBe(announcement);

  storage.full = true;
  noteSaveButton(root).click();
  expect(status(root).textContent).toBe(UNAVAILABLE);
  expect(field(root, 'definition').value, 'notes stay available for this visit').toBe('Care');
  expect(
    mountCompass([], blockedStorage()).root.querySelector('.compass-save [role="status"]')?.textContent,
    'warned before editing',
  ).toBe(UNAVAILABLE);
});

test('choosing a compass value opens its definition and reflection', () => {
  const storage = memoryStorage();
  const { root, button, detail, pressed, form } = mountCompass(['love', 'trust', 'honesty'], storage);
  expect(detail()).toStrictEqual([
    'What guides you?',
    'Tap or click a value on your compass to explore its meaning and describe it in your own words.',
  ]);
  expect(form.hidden).toBe(true);
  expect(root.querySelector('.compass-detail [aria-live] textarea'), 'typing is not inside the live region').toBe(null);

  button('Love').click();
  expect(detail()).toStrictEqual(['Love', value('love').description]);
  expect(pressed()).toStrictEqual(['Love']);
  expect($$(root, '.compass-spoke.is-active').length).toBe(1);
  expect(form.hidden).toBe(false);
  expect(labelFor(root, 'definition')).toBe('What Love means to me');
  rate(root, 'Love', 4);
  type(field(root, 'definition'), 'Care in action');
  type(field(root, 'reflection'), 'More patience at home');
  expect(pressSave(root, storage)).toStrictEqual({
    love: { definition: 'Care in action', reflection: 'More patience at home', rating: 4, actions: [] },
  });

  button('Trust').click();
  expect(pressed()).toStrictEqual(['Trust']);
  expect(field(root, 'definition').value).toBe('');
  button('Love').click();
  expect(field(root, 'definition').value).toBe('Care in action');
  expect(field(root, 'reflection').value).toBe('More patience at home');
  expect(ratingOf(root, 'Love')).toBe(4);
});

test('arrow, Home, and End keys move between values and their notes', () => {
  const storage = memoryStorage();
  const seed = createValueNotes(storage);
  seed.edit('honesty', { ...DEFAULT_NOTE, reflection: 'Say the hard thing kindly' });
  seed.save();
  const { root, button, pressed } = mountCompass(['love', 'trust', 'honesty'], storage);
  const [love, trust, honesty] = [button('Love'), button('Trust'), button('Honesty')];
  const moves: [from: HTMLElement, key: string, to: HTMLElement][] = [
    [love, 'ArrowRight', trust],
    [trust, 'ArrowDown', honesty],
    [honesty, 'ArrowRight', love],
    [love, 'ArrowLeft', honesty],
    [honesty, 'ArrowUp', trust],
    [trust, 'End', honesty],
    [honesty, 'Home', love],
  ];
  for (const [from, key, to] of moves) {
    from.focus();
    press(from, key);
    expect(document.activeElement, key).toBe(to);
    expect(pressed(), key).toStrictEqual([to.textContent]);
  }
  press(love, 'End');
  expect(field(root, 'reflection').value).toBe('Say the hard thing kindly');
  press(honesty, 'a');
  expect(pressed(), 'other keys are ignored').toStrictEqual(['Honesty']);
});

test('resizing redraws the compass but keeps the open value, its notes, and focus', () => {
  const { compass, root, button, pressed } = mountCompass(['love', 'trust']);
  button('Trust').click();
  type(field(root, 'definition'), 'Reliability');
  const before = button('Trust');
  before.focus();
  layout.resize(640);
  expect(button('Trust'), 'same width does not redraw').toBe(before);

  layout.resize(600);
  expect(button('Trust'), 'new width redraws').not.toBe(before);
  expect(document.activeElement, 'focus follows the redrawn value').toBe(button('Trust'));
  expect(pressed()).toStrictEqual(['Trust']);
  expect(field(root, 'definition').value).toBe('Reliability');

  ratingHandle(root, 'Trust').focus();
  layout.resize(620);
  expect(document.activeElement, 'focus follows the redrawn rating badge').toBe(ratingHandle(root, 'Trust'));

  field(root, 'definition').focus();
  layout.resize(580);
  expect(document.activeElement, 'typing focus is not stolen').toBe(field(root, 'definition'));

  compass.element.hidden = true;
  const hiddenButton = button('Trust');
  layout.resize(560);
  expect(button('Trust'), 'hidden compass does not redraw').toBe(hiddenButton);
});

test('a compass that is hidden or not laid out yet waits to draw until it can', () => {
  const { compass, button, findButton, form } = mountCompass(['love']);
  compass.element.hidden = true;
  compass.render([value('love'), value('trust')]);
  expect(findButton('Trust'), 'hidden compass is not drawn').toBe(undefined);

  compass.element.hidden = false;
  layout.width = 0;
  compass.render([value('love'), value('trust')]);
  expect(findButton('Trust'), 'not laid out yet').toBe(undefined);
  layout.resize(640);
  button('Trust').click();
  expect(form.hidden).toBe(false);
});

test('the compass draws a ring for each rating level and a tick at each level on every axis', () => {
  const { root } = mountCompass(['love', 'trust']);
  const { center, circleRadius, positions } = getCompassLayout(2, layout.width);
  const circles = $$(root, '.compass-ring, .compass-level, .compass-hub').map((circle) => ({
    className: circle.getAttribute('class'),
    cx: Number(circle.getAttribute('cx')),
    cy: Number(circle.getAttribute('cy')),
    r: Number(circle.getAttribute('r')),
  }));
  // The drawing is hidden from screen readers; the rating badges, which are sliders, are not.
  expect($(root, '.compass-ring').closest('[aria-hidden="true"]')).not.toBe(null);
  for (const handle of $$(root, '.compass-rating-handle')) expect(handle.closest('[aria-hidden="true"]')).toBe(null);
  const ring = (className: string, r: number) => ({ className, cx: center.x, cy: center.y, r });
  expect(circles).toStrictEqual([
    ring('compass-ring', circleRadius),
    ...[1, 2, 3, 4].map((level) => ring('compass-level', (circleRadius * level) / MAX_RATING)),
    ring('compass-hub', 12),
  ]);

  const ticks = $$(root, '.compass-tick').map((tick) => {
    const [x1, y1, x2, y2] = ['x1', 'y1', 'x2', 'y2'].map((name) => Number(tick.getAttribute(name)));
    return { middle: { x: (x1! + x2!) / 2, y: (y1! + y2!) / 2 }, direction: Math.atan2(y2! - y1!, x2! - x1!) };
  });
  expect(ticks).toHaveLength(positions.length * MAX_RATING);
  positions.forEach(({ angle }, axis) =>
    [1, 2, 3, 4, 5].forEach((level, index) => {
      const tick = ticks[axis * MAX_RATING + index]!;
      const expected = pointOnCircle(center, (circleRadius * level) / MAX_RATING, angle);
      expect(tick.middle.x, `axis ${axis} level ${level}`).toBeCloseTo(expected.x);
      expect(tick.middle.y, `axis ${axis} level ${level}`).toBeCloseTo(expected.y);
      // Each tick crosses its axis at a right angle.
      expect(Math.abs(Math.cos(tick.direction - (angle * Math.PI) / 180))).toBeCloseTo(0);
    }),
  );
});

/** A six-value compass with helpers to check where each value's rating is drawn. */
function mountRatedCompass(storage: KeyValueStorage = memoryStorage()) {
  const ids = SIX_VALUES.map(
    (name) =>
      required(
        values.find((item) => item.name === name),
        name,
      ).id,
  );
  const compass = mountCompass(ids, storage);
  const geometry = getCompassLayout(ids.length, layout.width);
  const { root } = compass;
  const corner = (index: number) => {
    const corners = required($(root, '.compass-rating-area').getAttribute('points'), 'points').split(' ');
    const [x, y] = corners[index]!.split(',').map(Number);
    return { x, y };
  };
  const badge = (index: number) => {
    const handle = $$(root, '.compass-rating-handle')[index]!;
    const match = required(/translate\(([-\d.]+) ([-\d.]+)\)/.exec(handle.getAttribute('transform') ?? ''), 'position');
    return { x: Number(match[1]), y: Number(match[2]) };
  };
  /** The point `rating` levels out along the value's axis. */
  const levelPoint = (index: number, rating: number) =>
    pointOnCircle(geometry.center, (geometry.circleRadius * rating) / MAX_RATING, geometry.positions[index]!.angle);
  const expectAtRating = (index: number, rating: number) => {
    const expected = levelPoint(index, rating);
    for (const actual of [corner(index), badge(index)]) {
      expect(actual.x).toBeCloseTo(expected.x);
      expect(actual.y).toBeCloseTo(expected.y);
    }
  };
  const score = (name: string) => ratingHandle(root, name).textContent;
  return { ...compass, ids, geometry, levelPoint, expectAtRating, score };
}

test('each value has a rating badge starting at 3 that works as a 1 to 5 slider from the keyboard', () => {
  const storage = memoryStorage();
  const { root, notes, ids, expectAtRating, score } = mountRatedCompass(storage);
  for (const [index, name] of SIX_VALUES.entries()) {
    const handle = ratingHandle(root, name);
    const attributes = ['role', 'tabindex', 'aria-valuemin', 'aria-valuemax', 'aria-valuenow', 'aria-valuetext'];
    expect(attributes.map((attribute) => handle.getAttribute(attribute))).toStrictEqual([
      'slider',
      '0',
      '1',
      '5',
      '3',
      '3 out of 5',
    ]);
    expect(score(name)).toBe('3');
    expectAtRating(index, 3);
  }
  expect(status(root).textContent, 'the default is not a change').toBe('');

  const trust = ratingHandle(root, 'Trust');
  const steps: [key: string, rating: number][] = [
    ['ArrowUp', 4],
    ['ArrowRight', 5],
    ['ArrowUp', 5],
    ['Home', 1],
    ['ArrowLeft', 1],
    ['ArrowRight', 2],
    ['ArrowDown', 1],
    ['End', 5],
  ];
  for (const [key, rating] of steps) {
    const keydown = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    trust.dispatchEvent(keydown);
    expect(keydown.defaultPrevented, `${key} changes the rating instead of scrolling the page`).toBe(true);
    expect(notes.get('trust').rating, key).toBe(rating);
    expect(trust.getAttribute('aria-valuetext'), key).toBe(`${rating} out of 5`);
    expect(score('Trust'), key).toBe(String(rating));
    expectAtRating(1, rating);
  }
  expectAtRating(0, 3);
  expect(status(root).textContent).toBe('Unsaved changes to Trust.');
  const other = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true });
  trust.dispatchEvent(other);
  expect(other.defaultPrevented, 'other keys are left alone').toBe(false);
  rate(root, 'Trust', 3);
  expect(status(root).textContent, 'back to the saved rating').toBe('');

  rate(root, 'Courage', 5);
  noteSaveButton(root).click();
  expect(savedNotes(storage).courage?.rating).toBe(5);
  document.body.replaceChildren();
  const reloaded = mountCompass(ids, storage);
  expect(ratingOf(reloaded.root, 'Courage'), 'saved ratings are drawn after a reload').toBe(5);
});

test("clicking the graph along a value's axis sets that value's rating", () => {
  const { root, notes, ids, geometry, levelPoint, expectAtRating } = mountRatedCompass();
  const clickAt = ({ x, y }: { x: number; y: number }) =>
    $(root, '.compass-ring').dispatchEvent(new MouseEvent('click', { clientX: x, clientY: y, bubbles: true }));
  for (const [index, name] of SIX_VALUES.entries()) {
    for (const rating of [1, 2, 3, 4, 5]) {
      clickAt(levelPoint(index, rating));
      expect(ratingOf(root, name), `${name} at level ${rating}`).toBe(rating);
      expectAtRating(index, rating);
    }
  }
  expect(status(root).textContent).toBe(`Unsaved changes to ${new Intl.ListFormat('en').format(SIX_VALUES)}.`);

  const ratings = () => ids.map((id) => notes.get(id).rating);
  const before = ratings();
  clickAt(geometry.center);
  clickAt({ x: geometry.center.x, y: geometry.center.y - geometry.circleRadius * 1.5 });
  expect(ratings(), 'clicks on the hub or outside the circle change nothing').toStrictEqual(before);
});

test('re-rendering keeps the open value only while it is still on the compass', () => {
  const { compass, button, detail, pressed, form } = mountCompass(['love', 'trust']);
  button('Trust').click();
  compass.render([value('love'), value('trust'), value('honesty')]);
  expect(pressed()).toStrictEqual(['Trust']);
  expect(form.hidden).toBe(false);
  compass.render([value('love')]);
  expect(pressed()).toStrictEqual([]);
  expect(detail()[0]).toBe('What guides you?');
  expect(form.hidden).toBe(true);
});

test('explore and start-again controls close the confirmation and hide notes after reset', () => {
  const { root, calls, button, detail, form } = mountCompass(['love']);
  const restart = $<HTMLButtonElement>(root, '.restart-button');
  const confirmation = $(root, '#restart-confirmation');
  expect(confirmation.textContent ?? '').toMatch(/ratings, definitions, reflections, and small actions/);

  restart.click();
  expect(confirmation.hidden).toBe(false);
  expect(restart.getAttribute('aria-expanded')).toBe('true');
  expect(document.activeElement, 'focus moves to cancel').toBe($(root, '.cancel-restart'));
  press(confirmation, 'Enter');
  expect(confirmation.hidden).toBe(false);
  press(confirmation, 'Escape');
  expect(confirmation.hidden).toBe(true);
  expect(document.activeElement, 'focus returns to start again').toBe(restart);

  restart.click();
  $(root, '.cancel-restart').click();
  expect(confirmation.hidden).toBe(true);
  expect(restart.getAttribute('aria-expanded')).toBe('false');

  restart.click();
  $(root, '.explore-button').click();
  expect(calls.explore).toBe(1);
  expect(confirmation.hidden).toBe(true);

  button('Love').click();
  restart.click();
  $(root, '.confirm-restart').click();
  expect(calls.reset).toBe(1);
  expect(form.hidden).toBe(true);
  expect(detail()[0]).toBe('What guides you?');
});
