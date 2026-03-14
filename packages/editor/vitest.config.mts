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
    onUnhandledError(error) {
      // Check if the error is a ZodError from Chanfana's validation and ignore it if so.
      const maybeZodError = error as {
        name?: string;
        issues?: unknown;
        stack?: string;
      };
      const stack = String(maybeZodError.stack ?? '');
      const isChanfanaValidationError =
        maybeZodError.name === 'ZodError' &&
        Array.isArray(maybeZodError.issues) &&
        stack.includes('chanfana') &&
        stack.includes('validateRequest');

      // Vitest 4 may report this handled validation path as unhandled rejection.
      if (isChanfanaValidationError) {
        return false;
      }
    },
  },
});
