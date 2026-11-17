// DOM helpers for the happy-dom unit tests.

export function required<T>(value: T | null | undefined, description: string): T {
  if (value === null || value === undefined) throw new Error(`Missing ${description}`);
  return value;
}

export const $ = <T extends Element = HTMLElement>(root: ParentNode, selector: string): T =>
  required(root.querySelector<T>(selector), selector);
export const $$ = <T extends Element = HTMLElement>(root: ParentNode, selector: string): T[] => [
  ...root.querySelectorAll<T>(selector),
];
export const text = (root: ParentNode, selector: string): string => $(root, selector).textContent ?? '';

/** Sets a field's value and fires the `input` event the app listens for. */
export function type(field: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  field.value = value;
  field.dispatchEvent(new Event('input', { bubbles: true }));
}

export function press(element: Element, key: string): void {
  element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}
