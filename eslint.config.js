import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Node-only globals. Type-checking cannot block these in app code, because Vite's and
// Vitest's type definitions load Node's types into the shared TypeScript program.
const nodeOnlyGlobals = ['process', 'Buffer', 'global', '__dirname', '__filename', 'require', 'module', 'setImmediate'];

export default defineConfig([
  globalIgnores(['dist', 'coverage']),
  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
  {
    files: ['src/**/*.ts'],
    languageOptions: { globals: globals.browser },
    rules: {
      'no-restricted-globals': [
        'error',
        ...nodeOnlyGlobals.map((name) => ({ name, message: 'App code runs in the browser.' })),
      ],
    },
  },
  {
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },
]);
