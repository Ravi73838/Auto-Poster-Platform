import { baseConfig } from './packages/eslint-config/index.js';

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.turbo/**',
      '**/.expo/**',
      '**/coverage/**',
      'apps/api/dist/**',
      'apps/web/dist/**',
    ],
  },
  ...baseConfig,
];
