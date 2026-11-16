import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
async function loadTypeScript(path, dependencies = {}) {
  let { outputText } = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  for (const [specifier, module] of Object.entries(dependencies)) {
    outputText = outputText.replaceAll(`'${specifier}'`, JSON.stringify(module));
  }
  const url = moduleUrl(outputText);
  return { url, exports: await import(url) };
}
const library = JSON.parse(readFileSync(new URL('../life_compass_intrinsic_values.json', import.meta.url), 'utf8'));
const data = await loadTypeScript('../src/features/values/values.data.ts', {
  '../../../life_compass_intrinsic_values.json': moduleUrl(`export default ${JSON.stringify(library)}`),
});
const { exports: { createValuesState, SELECTION_STORAGE_KEY, CORE_STORAGE_KEY } } = await loadTypeScript('../src/features/values/values.state.ts', { './values.data': data.url });
const { exports: { getCompassLayout, pointOnCircle } } = await loadTypeScript('../src/features/compass/compass.layout.ts');
function memoryStorage() {
  const saved = new Map();
  return { saved, getItem: (key) => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value), removeItem: (key) => saved.delete(key) };
}

test('1–6 values keep equal angles and readable, nonoverlapping labels across screen sizes', () => {
  for (const width of [272, 280, 300, 320, 327, 342, 359, 360, 382, 480, 600, 640]) {
    for (let count = 1; count <= 6; count++) {
      const layout = getCompassLayout(count, width);
      assert.equal(layout.positions.length, count);
      const boxes = layout.positions.map((position, index) => {
        assert.equal(position.angle, -90 + index * 360 / count);
        const measuredAngle = Math.atan2(position.point.y - layout.center.y, position.point.x - layout.center.x) * 180 / Math.PI;
        assert.ok(Math.abs(((measuredAngle - position.angle) % 360 + 540) % 360 - 180) < 1e-8);
        // Allow three 16px text lines plus padding, borders, and focus clearance.
        const box = { left: position.point.x - position.labelWidth / 2, right: position.point.x + position.labelWidth / 2, top: position.point.y - 42, bottom: position.point.y + 42 };
        assert.ok(box.left >= 0 && box.right <= width && box.top >= 0 && box.bottom <= layout.height, `Clipping at ${width}px with ${count} values`);
        return box;
      });
      for (let a = 0; a < boxes.length; a++) for (let b = a + 1; b < boxes.length; b++) {
        const x = boxes[a], y = boxes[b];
        assert.ok(x.right <= y.left || y.right <= x.left || x.bottom <= y.top || y.bottom <= x.top, `Overlap at ${width}px with ${count} values: ${a}, ${b}`);
      }
    }
  }
  assert.throws(() => getCompassLayout(0, 320), RangeError);
  assert.throws(() => getCompassLayout(7, 320), RangeError);
  assert.deepEqual(pointOnCircle({ x: 10, y: 10 }, 5, 0), { x: 15, y: 10 });
});

test('confirmed core values restore after reload; draft edits preserve selections', () => {
  for (let count = 1; count <= 6; count++) {
    const storage = memoryStorage();
    const state = createValuesState(storage);
    assert.equal(state.confirmCoreValues(), false);
    for (const value of library.values.slice(0, count)) state.toggle(value.id);
    assert.equal(state.hasCoreValues(), false);
    assert.equal(state.confirmCoreValues(), true);
    const restored = createValuesState(storage);
    assert.equal(restored.hasCoreValues(), true);
    assert.deepEqual([...restored.getSelectedIds()], [...state.getSelectedIds()]);
    assert.deepEqual(JSON.parse(storage.getItem(CORE_STORAGE_KEY)), [...state.getSelectedIds()]);
    restored.toggle(library.values[count].id);
    assert.equal(restored.hasCoreValues(), false);
    const draft = createValuesState(storage);
    assert.equal(draft.hasCoreValues(), false);
    assert.equal(draft.getSelectedIds().size, count + 1);
    if (count === 6) assert.equal(draft.confirmCoreValues(), false);
  }
});

test('reset clears only Life Compass keys; unavailable storage remains usable', () => {
  const storage = memoryStorage();
  storage.setItem('unrelated-key', 'keep');
  const state = createValuesState(storage);
  state.toggle('love');
  state.confirmCoreValues();
  state.reset();
  assert.equal(state.getSelectedIds().size, 0);
  assert.equal(state.hasCoreValues(), false);
  assert.equal(storage.getItem(SELECTION_STORAGE_KEY), null);
  assert.equal(storage.getItem(CORE_STORAGE_KEY), null);
  assert.equal(storage.getItem('unrelated-key'), 'keep');
  const fail = () => { throw Error('Storage blocked'); };
  const fallback = createValuesState({ getItem: fail, setItem: fail, removeItem: fail });
  fallback.toggle('love');
  assert.equal(fallback.confirmCoreValues(), true);
  assert.equal(fallback.isPersistenceAvailable(), false);
  fallback.reset();
  assert.equal(fallback.getSelectedIds().size, 0);
});

test('malformed, outdated, or mismatched saved core values do not restore an invalid compass', () => {
  for (const savedCore of ['{broken', '[]', '["outdated-id"]', '["love","love"]', '["trust"]']) {
    const storage = memoryStorage();
    storage.setItem(SELECTION_STORAGE_KEY, '["love","outdated-id",4]');
    storage.setItem(CORE_STORAGE_KEY, savedCore);
    const state = createValuesState(storage);
    assert.deepEqual([...state.getSelectedIds()], ['love']);
    assert.equal(state.hasCoreValues(), false);
  }
});
