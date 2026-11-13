import { defineConfig } from 'vitest/config';

// Unit / property tests: pure modules only (domain/, geometry/, render/,
// utils/). No browser, no Vite dev server. Run: npm run test:unit
export default defineConfig({
  test: {
    include: ['test/unit/**/*.test.ts'],
    environment: 'node',
    testTimeout: 120_000, // the fuzz and property tests run thousands of bakes
  },
});
