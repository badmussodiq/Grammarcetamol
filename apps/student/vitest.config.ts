import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@grammarcetamol/utilities': path.resolve(__dirname, '../utilities/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
  },
});
