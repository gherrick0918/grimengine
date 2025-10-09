import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const workspaceRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    clearMocks: true,
  },
  resolve: {
    alias: [
      {
        find: '@grimengine/core',
        replacement: resolve(workspaceRoot, 'packages/core/src/index.ts'),
      },
      {
        find: '@grimengine/core/',
        replacement: resolve(workspaceRoot, 'packages/core/src/') + '/',
      },
    ],
  },
});
