import { beforeEach, vi } from 'vitest';

export interface FakeLayout {
  width: number;
  readonly height: number;
  /** Changes the layout width and notifies every ResizeObserver. */
  resize(width: number): void;
}

// happy-dom has no layout engine, so element sizes come from `width`/`height` and
// ResizeObserver callbacks run on `resize()`. Each test also starts with an empty page and storage.
// Spies and stubbed globals are restored after each test (restoreMocks/unstubGlobals in vite.config.ts).
export function useFakeLayout(): FakeLayout {
  const observers = new Set<ResizeObserverCallback>();
  const layout: FakeLayout = {
    width: 640,
    height: 96,
    resize(width) {
      layout.width = width;
      // Only the fields the app reads are provided.
      const entries = [{ contentRect: { width, height: layout.height } }] as unknown as ResizeObserverEntry[];
      for (const callback of observers) callback(entries, {} as ResizeObserver);
    },
  };

  beforeEach(() => {
    layout.width = 640;
    observers.clear();
    document.body.replaceChildren();
    localStorage.clear();
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      () => new DOMRect(0, 0, layout.width, layout.height),
    );
    vi.stubGlobal(
      'ResizeObserver',
      class implements ResizeObserver {
        readonly #callback: ResizeObserverCallback;
        constructor(callback: ResizeObserverCallback) {
          this.#callback = callback;
        }
        observe(): void {
          observers.add(this.#callback);
        }
        unobserve(): void {
          observers.delete(this.#callback);
        }
        disconnect(): void {
          observers.delete(this.#callback);
        }
      },
    );
  });

  return layout;
}
