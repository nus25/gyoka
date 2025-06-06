declare module 'cloudflare:test' {
  // Controls the type of `import("cloudflare:test").env`
  interface ProvidedEnv extends Env {
    TEST_MIGRATIONS: D1Migration[]; // Defined in `vitest.config.ts`
    DB: D1Database; // Defined in `wrangler.toml`
  }
}
