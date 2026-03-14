import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Read all migrations in the `migrations` directory
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
    name: 'editor',
    include: ['**/*.spec.ts'],
    setupFiles: ['../shared/migrations/apply-migrations.ts'],
    silent: true,
  },
});
