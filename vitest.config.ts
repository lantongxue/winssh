import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve('src/renderer/src'),
      '@main': resolve('src/main'),
      '@renderer': resolve('src/renderer/src'),
      '@shared': resolve('src/shared'),
      '@test': resolve('test')
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['test/renderer/helpers/setup.ts'],
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
    exclude: ['node_modules/**', 'out/**', 'release/**', 'dist/**', 'package/**', 'web/**']
  }
})
