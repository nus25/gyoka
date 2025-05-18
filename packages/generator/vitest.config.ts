import path from 'node:path';
import { defineWorkersProject, readD1Migrations } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersProject(async () => {
	// Read all migrations in the `migrations` directory
	const migrationsPath = path.join(__dirname, '../shared/migrations');
	const migrations = await readD1Migrations(migrationsPath);

	return {
		test: {
			name: 'generator',
			include: ["**/*.spec.ts"],
			setupFiles: ['../shared/migrations/apply-migrations.ts'],
			poolOptions: {
				workers: {
					singleWorker: true,
					wrangler: {
						configPath: './wrangler.jsonc',
						environment: 'test'
					},
					miniflare: {
						// Add a test-only binding for migrations, so we can apply them in a
						// setup file
						bindings: { TEST_MIGRATIONS: migrations },
					},
				},
			},
			coverage: {
				provider: 'istanbul' // or 'v8'
			},
		},
	};
});
