import { createValuesScreen } from '../../src/features/values/ValuesScreen';
import type { NoteField, Rating } from '../../src/features/values/values.notes';
import { $, $$, press, required, text, type } from './dom';

export type AppDriver = ReturnType<typeof mountApp>;

/** Six real values, in the order the compass draws them. */
export const SIX_VALUES = ['Love', 'Trust', 'Kindness', 'Patience', 'Honesty', 'Courage'] as const;

export const noteField = (root: ParentNode, name: NoteField) => $<HTMLTextAreaElement>(root, `#value-note-${name}`);
/** A value's rating badge on the compass, which works as a slider. */
export const ratingHandle = (root: ParentNode, valueName: string) =>
  $<SVGGElement>(root, `.compass-rating-handle[aria-label="${valueName} rating"]`);
export const ratingOf = (root: ParentNode, valueName: string) =>
  Number(ratingHandle(root, valueName).getAttribute('aria-valuenow'));

/** Sets a rating the way a keyboard user would: Home for the lowest, then up one step at a time. */
export function rate(root: ParentNode, valueName: string, rating: Rating): void {
  const handle = ratingHandle(root, valueName);
  press(handle, 'Home');
  for (let step = 1; step < rating; step++) press(handle, 'ArrowUp');
}
export const noteSaveButton = (root: ParentNode) => $<HTMLButtonElement>(root, '.compass-save button');

/** Mounts the real app in place of the page content and drives it through its UI. */
export function mountApp() {
  const root = createValuesScreen();
  document.body.replaceChildren(root);
  const find = (selector: string, label: string) =>
    required(
      $$(root, selector).find((element) => element.textContent === label),
      `${selector} "${label}"`,
    );
  const app = {
    root,
    text: (selector: string) => text(root, selector),
    view: () => $$(root, ':scope > :not([hidden]) h1').map((heading) => heading.textContent),
    toggle: (...names: string[]) => {
      for (const name of names) required(find('.values-results .value-card__name', name).parentElement, name).click();
    },
    search: (query: string) => type($<HTMLInputElement>(root, '#value-search'), query),
    click: (selector: string) => $(root, selector).click(),
    continueToCompass: () => app.click('.selection-bar button'),
    explore: () => app.click('.explore-button'),
    compassButton: (name: string) => find('.compass-value', name),
    open: (name: string) => app.compassButton(name).click(),
    field: (name: NoteField) => noteField(root, name),
    /** Toggles the named values on the explore screen, then continues to the compass. */
    chooseCoreValues: (...names: string[]) => {
      app.toggle(...names);
      app.continueToCompass();
    },
    /** Rates a compass value and enters its notes, without saving. */
    write: (valueName: string, { rating, ...note }: Partial<Record<NoteField, string>> & { rating?: Rating }) => {
      if (rating !== undefined) rate(root, valueName, rating);
      app.open(valueName);
      for (const [field, text] of Object.entries(note) as [NoteField, string][]) type(app.field(field), text);
    },
    save: () => noteSaveButton(root).click(),
  };
  return app;
}
