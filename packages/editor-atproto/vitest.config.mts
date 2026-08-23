import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

const migrationsPath = path.join(__dirname, '../shared/migrations');
const migrations = await readD1Migrations(migrationsPath);

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc', environment: 'test' },
      miniflare: {
        bindings: { TEST_MIGRATIONS: migrations },
      },
    }),
  ],
  test: {
    name: 'editor-atproto',
    include: ['**/*.spec.ts'],
    setupFiles: ['../shared/migrations/apply-migrations.ts'],
    silent: true,
    coverage: {
      enabled: false,
      include: ['src/**/*.ts'],
      exclude: ['**/test/**', 'src/lexicons/**'],
      provider: 'istanbul',
    },
  },
});
