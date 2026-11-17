import { expect, test } from 'vitest';
import library from '../../life_compass_intrinsic_values.json';
import {
  CORE_STORAGE_KEY,
  CORE_VALUE_COUNT,
  createValuesState,
  SELECTION_STORAGE_KEY,
} from '../../src/features/values/values.state';
import {
  BADGE_RADIUS,
  getCompassLayout,
  LABEL_HEIGHT,
  pointOnCircle,
  ratingAtPoint,
} from '../../src/features/compass/compass.layout';
import { blockedStorage, memoryStorage, readJson } from '../support/storage';

// Compass widths for screens 600px wide and up (the page has 24px padding on each side).
const COMPASS_WIDTHS = [552, 580, 600, 620, 640];

test('six evenly spaced axes, with labels around the circle that fit and never cover the ratings', () => {
  for (const width of COMPASS_WIDTHS) {
    const { height, center, circleRadius, positions } = getCompassLayout(CORE_VALUE_COUNT, width);
    expect(positions.map(({ angle }) => angle)).toStrictEqual([-90, -30, 30, 90, 150, 210]);
    const boxes = positions.map(({ angle, point, placement, labelWidth }) => {
      const left = { above: -0.5, below: -0.5, left: -1, right: 0 }[placement] * labelWidth + point.x;
      const top = { above: -1, below: 0, left: -0.5, right: -0.5 }[placement] * LABEL_HEIGHT + point.y;
      const box = { left, right: left + labelWidth, top, bottom: top + LABEL_HEIGHT };
      const where = `${angle}° at ${width}px`;
      expect(box.left >= 0 && box.right <= width && box.top >= 0 && box.bottom <= height, `fits: ${where}`).toBe(true);
      // The label's nearest point to the centre stays outside the ring and any top-rated badge on it.
      const nearest = Math.hypot(
        Math.max(box.left - center.x, 0, center.x - box.right),
        Math.max(box.top - center.y, 0, center.y - box.bottom),
      );
      expect(nearest, `clear of the ratings: ${where}`).toBeGreaterThan(circleRadius + BADGE_RADIUS);
      // Labels extend away from the circle, on their axis's side.
      const axis = pointOnCircle({ x: 0, y: 0 }, 1, angle);
      const expected = Math.abs(axis.x) < 0.01 ? (axis.y < 0 ? 'above' : 'below') : axis.x > 0 ? 'right' : 'left';
      expect(placement, where).toBe(expected);
      return box;
    });
    for (let a = 0; a < boxes.length; a++)
      for (let b = a + 1; b < boxes.length; b++) {
        const x = boxes[a]!,
          y = boxes[b]!;
        expect(
          x.right <= y.left || y.right <= x.left || x.bottom <= y.top || y.bottom <= x.top,
          `Overlap at ${width}px: ${a}, ${b}`,
        ).toBe(true);
      }
  }
  expect(pointOnCircle({ x: 10, y: 10 }, 5, 0)).toStrictEqual({ x: 15, y: 10 });
});

test('pointing at the compass picks the nearest axis and the nearest rating level along it', () => {
  const layout = getCompassLayout(CORE_VALUE_COUNT, 640);
  const { center, circleRadius } = layout;
  const step = circleRadius / 5;
  const at = (angle: number, distance: number) => ratingAtPoint(layout, pointOnCircle(center, distance, angle), 5);
  expect(at(-90, 3 * step), 'on the top axis').toStrictEqual({ index: 0, rating: 3 });
  expect(at(-90 + 25, 3 * step), 'nearer the top axis than the next').toStrictEqual({ index: 0, rating: 3 });
  // 25° off the next axis, 4 levels out: it lies 4 × cos 25° ≈ 3.6 levels along that axis.
  expect(at(-90 + 35, 4 * step), 'nearer the next axis').toStrictEqual({ index: 1, rating: 4 });
  expect(at(210, 5 * step), 'angles wrap around').toStrictEqual({ index: 5, rating: 5 });
  expect(at(30, 0.6 * step), 'just outside the hub rounds up to the lowest rating').toStrictEqual({
    index: 2,
    rating: 1,
  });
  expect(at(30, 0.4 * step), 'the hub belongs to no axis').toBe(null);
  expect(at(90, circleRadius + 0.4 * step), 'just past the outer ring').toStrictEqual({ index: 3, rating: 5 });
  expect(at(90, circleRadius + 0.6 * step), 'well outside the circle').toBe(null);
});

test('only exactly six values can be confirmed, and a confirmed compass restores after reload', () => {
  expect(CORE_VALUE_COUNT).toBe(6);
  const ids = library.values.map((value) => value.id);
  for (const count of [0, 1, 5, 7, 8]) {
    const state = createValuesState(memoryStorage());
    for (const id of ids.slice(0, count)) state.toggle(id);
    expect(state.canContinue(), `${count} values`).toBe(false);
    expect(state.confirmCoreValues(), `${count} values`).toBe(false);
    expect(state.hasCoreValues()).toBe(false);
  }

  const storage = memoryStorage();
  const state = createValuesState(storage);
  for (const id of ids.slice(0, 6)) state.toggle(id);
  expect(state.hasCoreValues()).toBe(false);
  expect(state.canContinue()).toBe(true);
  expect(state.confirmCoreValues()).toBe(true);
  const restored = createValuesState(storage);
  expect(restored.hasCoreValues()).toBe(true);
  expect([...restored.getSelectedIds()]).toStrictEqual(ids.slice(0, 6));
  expect(readJson(storage, CORE_STORAGE_KEY)).toStrictEqual(ids.slice(0, 6));

  restored.toggle(ids[6]!);
  expect(restored.hasCoreValues(), 'changing the selection needs a new confirmation').toBe(false);
  const draft = createValuesState(storage);
  expect(draft.hasCoreValues()).toBe(false);
  expect(draft.getSelectedIds().size, 'the selection itself is kept').toBe(7);
  expect(draft.confirmCoreValues()).toBe(false);
});

test('a compass saved with fewer than six values is not restored, but its selection is kept', () => {
  const older = JSON.stringify(['love', 'trust', 'honesty']);
  const storage = memoryStorage({ [SELECTION_STORAGE_KEY]: older, [CORE_STORAGE_KEY]: older });
  const state = createValuesState(storage);
  expect(state.hasCoreValues()).toBe(false);
  expect([...state.getSelectedIds()]).toStrictEqual(['love', 'trust', 'honesty']);

  // A confirmation for part of the current selection does not confirm all six.
  const six = library.values.slice(0, 6).map((value) => value.id);
  const partial = createValuesState(
    memoryStorage({
      [SELECTION_STORAGE_KEY]: JSON.stringify(six),
      [CORE_STORAGE_KEY]: JSON.stringify(six.slice(0, 3)),
    }),
  );
  expect(partial.getSelectedIds().size).toBe(6);
  expect(partial.hasCoreValues()).toBe(false);
});

test('reset clears only Life Compass keys; unavailable storage remains usable', () => {
  const storage = memoryStorage();
  storage.setItem('unrelated-key', 'keep');
  const six = library.values.slice(0, 6).map((value) => value.id);
  const state = createValuesState(storage);
  for (const id of six) state.toggle(id);
  expect(state.confirmCoreValues()).toBe(true);
  expect(storage.getItem(CORE_STORAGE_KEY)).not.toBe(null);
  state.reset();
  expect(state.getSelectedIds().size).toBe(0);
  expect(state.hasCoreValues()).toBe(false);
  expect(storage.getItem(SELECTION_STORAGE_KEY)).toBe(null);
  expect(storage.getItem(CORE_STORAGE_KEY)).toBe(null);
  expect(storage.getItem('unrelated-key')).toBe('keep');
  const fallback = createValuesState(blockedStorage());
  for (const id of six) fallback.toggle(id);
  expect(fallback.confirmCoreValues()).toBe(true);
  expect(fallback.isPersistenceAvailable()).toBe(false);
  fallback.reset();
  expect(fallback.getSelectedIds().size).toBe(0);
});

test('malformed, outdated, or mismatched saved core values do not restore an invalid compass', () => {
  for (const savedCore of ['{broken', '[]', '["outdated-id"]', '["love","love"]', '["trust"]']) {
    const storage = memoryStorage();
    storage.setItem(SELECTION_STORAGE_KEY, '["love","outdated-id",4]');
    storage.setItem(CORE_STORAGE_KEY, savedCore);
    const state = createValuesState(storage);
    expect([...state.getSelectedIds()]).toStrictEqual(['love']);
    expect(state.hasCoreValues()).toBe(false);
  }
});

test('selection listeners receive the current selection and every change; unknown IDs are ignored', () => {
  const storage = memoryStorage();
  const state = createValuesState(storage);
  const seen: string[][] = [];
  state.subscribe((ids) => seen.push([...ids]));
  state.toggle('outdated-id');
  state.toggle('love');
  state.toggle('trust');
  expect(seen).toStrictEqual([[], ['love'], ['love', 'trust']]);
  expect(readJson(storage, SELECTION_STORAGE_KEY)).toStrictEqual(['love', 'trust']);
});
