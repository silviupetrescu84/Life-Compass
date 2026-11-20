import { basename } from 'node:path';
import type { PreviewServer, ViteDevServer } from 'vite';
import { defineConfig } from 'vitest/config';

async function enableAccounts(server: ViteDevServer | PreviewServer): Promise<void> {
  if (server.config.mode === 'test') return;
  const { createApi } = await import('./server/api.ts');
  const api = createApi();
  server.httpServer?.once('close', api.close);
  server.middlewares.use((req, res, next) => {
    if (req.url?.startsWith('/api/')) void api.handle(req, res);
    else next();
  });
}

export default defineConfig({
  plugins: [
    {
      name: 'life-compass-api',
      configureServer: enableAccounts,
      configurePreviewServer: enableAccounts,
    },
  ],
  server: {
    fs: {
      deny: [
        '.env',
        '.env.*',
        '*.{crt,pem}',
        '**/.git/**',
        '**/data/**',
        '**/*.sqlite*',
        ...(process.env.LIFE_COMPASS_DB ? [`**/${basename(process.env.LIFE_COMPASS_DB)}*`] : []),
      ],
    },
  },
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
