import { cloudflare } from '@cloudflare/vite-plugin';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const dataPath = fileURLToPath(new URL('./data', import.meta.url));

export default defineConfig({
  build: {
    minify: true,
    sourcemap: true,
  },
  plugins: [cloudflare({ persistState: { path: dataPath } })],
});
