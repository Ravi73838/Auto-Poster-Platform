import { webConfig } from '@ap/eslint-config';

export default [
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  ...webConfig,
];
