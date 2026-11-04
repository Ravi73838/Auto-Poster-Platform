import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@ap/shared-constants': path.resolve(__dirname, './src/shared/constants/index.ts'),
      '@ap/shared-types': path.resolve(__dirname, './src/shared/types/index.ts'),
      '@ap/shared-validation': path.resolve(__dirname, './src/shared/validation/index.ts'),
      '@ap/shared-i18n': path.resolve(__dirname, './src/shared/i18n/index.ts'),
      '@ap/design-tokens': path.resolve(__dirname, './src/shared/tokens/index.ts'),
      '@ap/api-client': path.resolve(__dirname, './src/shared/api-client/index.ts'),
      '@ap/shared-money': path.resolve(__dirname, './src/shared/money/index.ts'),
      '@ap/shared-time': path.resolve(__dirname, './src/shared/time/index.ts'),
    },
  },
  server: {
    port: 5173,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
});
