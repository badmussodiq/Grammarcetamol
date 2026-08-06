import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@grammarcetamol/utilities': path.resolve(__dirname, '../utilities/src/index.ts'),
      '@': path.resolve(__dirname, './'),
    },
    // apps/utilities is a sibling with its own node_modules (see its README), so without
    // this, importing its source directly (the alias above) pulls in a second copy of
    // react/react-dom — "Invalid hook call" from two React instances in one render tree.
    dedupe: ['react', 'react-dom'],
  },
  test: {
    // jsdom (not 'node') — needed for component/integration tests that render real client
    // components with React Testing Library. Pure logic tests (lib/*.api.test.ts) run fine
    // under jsdom too, same as apps/utilities already does for its own mixed suite.
    environment: 'jsdom',
    globals: true,
  },
});
