export const SELECTION_STORAGE_KEY = 'life-compass.selected-value-ids';
export const CORE_STORAGE_KEY = 'life-compass.core-value-ids';
export const NOTES_STORAGE_KEY = 'life-compass.value-notes';

export const COMPASS_STORAGE_KEYS = [SELECTION_STORAGE_KEY, CORE_STORAGE_KEY, NOTES_STORAGE_KEY] as const;
export type CompassStorageKey = (typeof COMPASS_STORAGE_KEYS)[number];
export type CompassData = Partial<Record<CompassStorageKey, string>>;
export type SelectionChanges = Partial<Record<typeof SELECTION_STORAGE_KEY | typeof CORE_STORAGE_KEY, string | null>>;
export type NoteChanges = { clear?: boolean; entries: Record<string, unknown> };
export type CompassChanges = SelectionChanges & { [NOTES_STORAGE_KEY]?: NoteChanges };

export interface AccountSession {
  accountId: number;
  email: string;
  data: CompassData;
}
