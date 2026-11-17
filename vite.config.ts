import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Undo vi.spyOn and vi.stubGlobal after every test so tests cannot leak into each other.
    restoreMocks: true,
    unstubGlobals: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      reporter: ['text', 'html'],
      // Every line of app code must stay covered by the unit tests.
      thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 },
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
          // DOM tests opt in to happy-dom with a `// @vitest-environment happy-dom` comment.
          environment: 'node',
        },
      },
    ],
  },
});
