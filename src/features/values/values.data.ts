import library from '../../../life_compass_intrinsic_values.json' with { type: 'json' };
import type { Value, ValueCategory } from './values.types';

export const values: readonly Value[] = library.values;

// Map insertion order preserves the categories and values in the source library.
const grouped = new Map<string, Value[]>();
for (const value of values) {
  const category = grouped.get(value.category) ?? [];
  category.push(value);
  grouped.set(value.category, category);
}

export const valueCategories: readonly ValueCategory[] = Array.from(grouped, ([name, categoryValues]) => ({
  name,
  values: categoryValues,
}));

const valueIds: ReadonlySet<string> = new Set(values.map((value) => value.id));

export function isValueId(id: unknown): id is string {
  return typeof id === 'string' && valueIds.has(id);
}
