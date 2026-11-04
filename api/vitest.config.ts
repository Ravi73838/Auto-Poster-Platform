import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
  },
  resolve: {
    alias: {
      '@ap/shared-constants': path.resolve(__dirname, 'src/contract/constants/index.ts'),
      '@ap/shared-types': path.resolve(__dirname, 'src/contract/types/index.ts'),
      '@ap/shared-validation': path.resolve(__dirname, 'src/contract/validation/index.ts'),
      '@ap/shared-i18n': path.resolve(__dirname, 'src/contract/i18n/index.ts'),
      '@ap/design-tokens': path.resolve(__dirname, 'src/contract/tokens/index.ts'),
      '@ap/api-client': path.resolve(__dirname, 'src/contract/api-client/index.ts'),
      '@ap/shared-money': path.resolve(__dirname, 'src/contract/money/index.ts'),
      '@ap/shared-time': path.resolve(__dirname, 'src/contract/time/index.ts'),
    },
  },
});
