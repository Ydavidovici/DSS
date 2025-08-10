// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/tests/**/*.test.ts'],
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
  },
});