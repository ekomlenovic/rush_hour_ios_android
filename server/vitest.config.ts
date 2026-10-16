import { defineConfig } from 'vitest/config';

export default defineConfig({
  // The game logic of the app (../utils) is compiled with this tsconfig too: the one of
  // the app extends expo/tsconfig.base, not installed with the server
  tsconfig: './tsconfig.json',
  test: {
    include: ['test/**/*.test.ts'],
    // Real puzzle generation takes seconds
    testTimeout: 60_000,
  },
});
