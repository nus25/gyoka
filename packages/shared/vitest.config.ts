import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'shared',
    include: ['**/*.spec.ts', '**/*.test.ts'],
    coverage: {
      include: ['src/**/*.{ts,tsx}'],
      provider: 'istanbul',
    },
    silent: true,
  },
});
