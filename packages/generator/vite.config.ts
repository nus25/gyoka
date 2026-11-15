import { defineConfig } from 'vite';

import sharedConfig from '../../vite.config.shared.ts';

export default defineConfig({
  ...sharedConfig,
  server: {
    ...(sharedConfig.server ?? {}),
    port: 5174,
  },
});
