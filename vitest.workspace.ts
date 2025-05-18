import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  "./packages/generator/vitest.config.ts",
  "./packages/editor/vitest.config.ts",
  "./packages/shared/vitest.config.ts"
])
