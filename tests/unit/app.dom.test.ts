// @vitest-environment happy-dom
import { expect, test, vi } from 'vitest';
import { NOTES_STORAGE_KEY } from '../../src/features/values/values.notes';
import { CORE_STORAGE_KEY, SELECTION_STORAGE_KEY } from '../../src/features/values/values.state';
import { mountApp, ratingOf, SIX_VALUES, type AppDriver } from '../support/app';
import { $, $$, required, text, type } from '../support/dom';
import { useFakeLayout } from '../support/fake-layout';
import { readJson } from '../support/storage';

const layout = useFakeLayout();

test('ratings, definitions, and reflections entered on the compass are saved and restored after reload', () => {
  let app = mountApp();
  app.chooseCoreValues(...SIX_VALUES);
  expect(app.view()).toStrictEqual(['Your Life Compass']);
  app.write('Love', {
    definition: 'Choosing care, even when it is hard.',
    reflection: 'I want to listen more at home.',
    rating: 4,
  });
  app.write('Trust', { reflection: 'Keeping small promises.' });
  app.save();
  type(app.field('definition'), 'Typed but never saved');

  app = mountApp();
  expect(app.view(), 'reload returns to the saved compass').toStrictEqual(['Your Life Compass']);
  app.open('Love');
  expect(app.field('definition').value).toBe('Choosing care, even when it is hard.');
  expect(app.field('reflection').value).toBe('I want to listen more at home.');
  expect(ratingOf(app.root, 'Love')).toBe(4);
  app.open('Trust');
  expect(app.field('definition').value, 'unsaved text does not survive a reload').toBe('');
  expect(app.field('reflection').value).toBe('Keeping small promises.');
});

/** A compass of six values, where Love has an unsaved definition. */
function compassWithLoveNote() {
  const app = mountApp();
  app.chooseCoreValues(...SIX_VALUES);
  app.write('Love', { definition: 'Care in action' });
  return app;
}

function expectLoveNote(app: AppDriver): void {
  app.open('Love');
  expect(app.field('definition').value).toBe('Care in action');
}

test('unsaved edits survive switching values and visiting Explore, then one Save stores them all', () => {
  const app = compassWithLoveNote();
  app.write('Love', { rating: 5 });
  app.write('Trust', { rating: 2 });
  app.explore();
  app.continueToCompass();
  expect(app.text('.compass-save [role="status"]')).toBe('Unsaved changes to Love and Trust.');
  expectLoveNote(app);
  expect(window.localStorage.getItem(NOTES_STORAGE_KEY)).toBe(null);

  app.save();
  expect(readJson(window.localStorage, NOTES_STORAGE_KEY)).toStrictEqual({
    love: { definition: 'Care in action', reflection: '', rating: 5, actions: [] },
    trust: { definition: '', reflection: '', rating: 2, actions: [] },
  });
});

test('notes are kept when a value leaves the compass and return when it is chosen again', () => {
  const app = compassWithLoveNote();
  app.save();

  const compassNames = () => $$(app.root, '.compass-value').map((button) => button.textContent);
  app.explore();
  app.chooseCoreValues('Love', 'Joy');
  expect(compassNames()).toStrictEqual(['Trust', 'Kindness', 'Patience', 'Honesty', 'Courage', 'Joy']);
  expect(window.localStorage.getItem(NOTES_STORAGE_KEY) ?? '').toMatch(/Care in action/);

  app.explore();
  app.chooseCoreValues('Joy', 'Love');
  expectLoveNote(app);
});

test('starting again clears values and notes but leaves other sites\u2019 data alone', () => {
  window.localStorage.setItem('unrelated-key', 'keep');
  const app = mountApp();
  app.chooseCoreValues(...SIX_VALUES);
  app.write('Love', { definition: 'Care', rating: 3 });
  app.save();
  app.write('Trust', { rating: 4 });
  app.click('.restart-button');
  app.click('.confirm-restart');

  expect(app.view()).toStrictEqual(['What matters most to you?']);
  expect(app.text('.selection-count')).toBe('0 of 6 values selected');
  for (const key of [NOTES_STORAGE_KEY, SELECTION_STORAGE_KEY, CORE_STORAGE_KEY])
    expect(window.localStorage.getItem(key), key).toBe(null);
  expect(window.localStorage.getItem('unrelated-key')).toBe('keep');
  expect(mountApp().view()).toStrictEqual(['What matters most to you?']);
  document.body.replaceChildren(app.root);
  app.chooseCoreValues(...SIX_VALUES);
  app.open('Trust');
  expect(ratingOf(app.root, 'Trust'), 'unsaved edits are cleared too').toBe(3);
  expect(app.text('.compass-save [role="status"]')).toBe('');
});

test('the selection bar counts toward six values and only continues with exactly six', () => {
  const app = mountApp();
  const continueButton = $<HTMLButtonElement>(app.root, '.selection-bar button');
  const bar = () => [app.text('.selection-count'), app.text('.selection-guidance'), continueButton.disabled];
  expect(continueButton.textContent).toBe('Continue');
  expect(continueButton.getAttribute('aria-describedby'), 'the button explains why it is disabled').toBe(
    'selection-guidance',
  );
  expect($(app.root, '.selection-bar [role="status"]').contains($(app.root, '.selection-guidance'))).toBe(true);
  expect(app.text('.selection-bar .storage-note')).toBe('Saved on this device. You can change these later.');
  expect(bar()).toStrictEqual(['0 of 6 values selected', 'Add 6 values to continue.', true]);

  app.toggle('Love');
  expect(bar()).toStrictEqual(['1 of 6 values selected', 'Add 5 values to continue.', true]);
  app.toggle('Connection', 'Friendship', 'Intimacy');
  app.toggle('Affection');
  expect(bar()).toStrictEqual(['5 of 6 values selected', 'Add 1 value to continue.', true]);
  app.toggle('Belonging');
  expect(bar()).toStrictEqual(['6 of 6 values selected', 'Ready when you are.', false]);
  app.toggle('Loyalty');
  expect(bar()).toStrictEqual(['7 of 6 values selected', 'Remove 1 value to continue.', true]);
  app.toggle('Trust');
  expect(bar()).toStrictEqual(['8 of 6 values selected', 'Remove 2 values to continue.', true]);

  // Even if the button were wrongly enabled, only exactly six values can continue.
  continueButton.disabled = false;
  app.continueToCompass();
  expect(app.view()).toStrictEqual(['What matters most to you?']);

  app.toggle('Loyalty', 'Trust');
  app.continueToCompass();
  expect(app.view()).toStrictEqual(['Your Life Compass']);
  expect($$(app.root, '.compass-value').map((button) => button.textContent)).toStrictEqual([
    'Love',
    'Connection',
    'Friendship',
    'Intimacy',
    'Affection',
    'Belonging',
  ]);
});

test('search and category filters work together and update the counts', () => {
  const app = mountApp();
  const chip = (name: string) =>
    required(
      $$(app.root, '.category-chip').find((element) => element.textContent === name),
      `chip ${name}`,
    );
  const visibleCategories = () => $$(app.root, '.value-category').filter((section) => !section.hidden).length;
  expect(app.text('.results-count')).toBe('120 values to explore');
  expect(app.text('#category-0 .category-count')).toBe('10 values');
  app.search('closeness');
  expect(app.text('.results-count')).toBe('1 value to explore');
  expect(app.text('#category-0 .category-count')).toBe('1 value');
  app.click('.clear-filters');

  chip('Love & Relationships').click();
  expect(chip('Love & Relationships').getAttribute('aria-pressed')).toBe('true');
  expect(chip('All').getAttribute('aria-pressed')).toBe('false');
  expect(app.text('.results-count')).toBe('10 values to explore');
  expect(visibleCategories()).toBe(1);
  app.search('no such value');
  expect($(app.root, '.empty-state').hidden).toBe(false);
  app.click('.clear-filters');
  expect(chip('All').getAttribute('aria-pressed')).toBe('true');
  expect(visibleCategories()).toBe(12);
});

test('without storage, the app and notes still work for this visit and say so', () => {
  vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
    throw new DOMException('Access denied', 'SecurityError');
  });
  const app = mountApp();
  expect(app.text('.selection-bar .storage-note')).toBe(
    'Storage unavailable. Your choices will last for this visit only.',
  );
  app.chooseCoreValues(...SIX_VALUES);
  app.write('Love', { definition: 'Care' });
  app.save();
  expect(app.text('.compass-save [role="status"]')).toBe(
    'Storage unavailable. Your notes will last for this visit only.',
  );
  app.explore();
  app.continueToCompass();
  app.open('Love');
  expect(app.field('definition').value).toBe('Care');
});

test('the selection bar height is reserved when it resizes, only while the bar is shown', () => {
  const app = mountApp();
  const reserved = () => app.root.style.getPropertyValue('--selection-bar-height');
  layout.resize(640);
  expect(reserved()).toBe(`${layout.height}px`);
  app.chooseCoreValues(...SIX_VALUES);
  app.root.style.removeProperty('--selection-bar-height');
  layout.resize(600);
  expect(reserved(), 'the bar is hidden on the compass').toBe('');
});

test('the app mounts the header and values screen, and requires its root element', async () => {
  // main.ts runs on import, so each case re-evaluates it from a fresh module registry.
  vi.resetModules();
  await expect(import('../../src/app/main')).rejects.toThrow(/Application root is missing/);
  document.body.innerHTML = '<div id="app"></div>';
  vi.resetModules();
  await import('../../src/app/main');
  const root = $(document, '#app');
  expect(text(root, '.site-header .brand').trim()).toBe('Life Compass');
  expect(text(root, 'main#main-content h1')).toBe('What matters most to you?');
});
