import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/db/**', 'node_modules/**'],
    setupFiles: ['tests/setup.ts'],
    // Dùng chung một CSDL nên chạy tuần tự để tránh tranh chấp.
    fileParallelism: false,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    testTimeout: 60_000,
    hookTimeout: 60_000,
    reporters: ['default'],
  },
})
