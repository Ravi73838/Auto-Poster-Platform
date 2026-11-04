import { defineConfig } from 'tsup';
import path from 'node:path';

export default defineConfig({
  entry: {
    main: 'src/main.ts',
    worker: 'src/jobs/worker.ts',
  },
  format: ['esm'],
  target: 'node22',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  dts: false,
  noExternal: [/^@ap\//],
  esbuildOptions(options) {
    options.alias = {
      '@ap/shared-constants': path.resolve(__dirname, 'src/contract/constants/index.ts'),
      '@ap/shared-types': path.resolve(__dirname, 'src/contract/types/index.ts'),
      '@ap/shared-validation': path.resolve(__dirname, 'src/contract/validation/index.ts'),
      '@ap/shared-i18n': path.resolve(__dirname, 'src/contract/i18n/index.ts'),
      '@ap/design-tokens': path.resolve(__dirname, 'src/contract/tokens/index.ts'),
      '@ap/api-client': path.resolve(__dirname, 'src/contract/api-client/index.ts'),
      '@ap/shared-money': path.resolve(__dirname, 'src/contract/money/index.ts'),
      '@ap/shared-time': path.resolve(__dirname, 'src/contract/time/index.ts'),
    };
  },
});
