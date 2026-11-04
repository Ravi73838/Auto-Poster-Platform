import { apiConfig } from '@ap/eslint-config';

export default [
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  ...apiConfig,
];
