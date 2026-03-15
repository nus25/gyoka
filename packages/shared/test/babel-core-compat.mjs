/**
 * Workaround for `TypeError: template is not a function` thrown from
 * @vitest/coverage-istanbul (provider.js) under Vitest 4.1 in this repo setup.
 *
 * Root issue:
 * - In some ESM/CJS interop paths, `@babel/core.template` is resolved as a
 *   module-like object instead of a callable function.
 * - coverage-istanbul expects `template(...)` to be callable during provider init.
 *
 * What this shim does:
 * - Loads real `@babel/core` via `createRequire`.
 * - Normalizes `template` to a callable:
 *   1) use `template` if it's already a function
 *   2) otherwise use `template.default` if that is a function
 *   3) otherwise keep original value (so failures remain explicit)
 *
 * Scope and caveat:
 * - Applied only in Vitest runtime via alias in vitest config.
 * - This is a temporary compatibility shim; remove once upstream fixes
 *   interop behavior in Vitest/coverage-istanbul/Babel combination.
 */

import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const core = require('@babel/core');
const templateCandidate = core.template;

// Vitest's ESM/CJS interop can wrap template in an object; normalize to a callable export.
const template =
  typeof templateCandidate === 'function'
    ? templateCandidate
    : typeof templateCandidate?.default === 'function'
      ? templateCandidate.default
      : templateCandidate;

const patchedCore = {
  ...core,
  template,
};

export default patchedCore;
