import type { Value } from './values.types';

export function filterValues(values: readonly Value[], search: string, category: string | null): readonly Value[] {
  const query = search.trim().toLowerCase();
  return values.filter(
    (value) =>
      (category === null || value.category === category) &&
      (value.name.toLowerCase().includes(query) || value.description.toLowerCase().includes(query)),
  );
}
