import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import json from '@eslint/json';

export default defineConfig([
  {
    files: ['**/*.{js,mjs,cjs,ts}'],
    plugins: { js },
    extends: ['js/recommended'],
  },
  {
    files: ['**/*.{js,mjs,cjs,ts}'],
    ignores: ['**/worker-configuration.d.ts'],
    languageOptions: { globals: globals.node },
    rules: {
      indent: ['error', 2],
    },
  },
  tseslint.configs.recommended,
  {
    files: ['**/*.jsonc'],
    plugins: { json },
    language: 'json/jsonc',
    extends: ['json/recommended'],
    rules: {
      indent: ['error', 2],
    },
  },
]);
