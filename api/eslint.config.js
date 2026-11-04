import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'prisma/migrations/**', 'coverage/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-useless-escape': 'warn',
      'prefer-const': 'warn',
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.name='console'][callee.property.name='log']",
          message: 'Unexpected console.log in api. Use the structured logger instead.',
        },
      ],
    },
  },
  {
    files: ['src/contract/**/*.{ts,tsx}'],
    ignores: ['src/contract/**/__tests__/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['node:*', 'fs', 'path', 'crypto', 'os', 'child_process', 'process', 'Buffer'],
              message: 'Contract files must be pure and cannot import Node built-ins.',
            },
            {
              group: ['@prisma/**', 'express', 'argon2', 'bullmq', 'ioredis', 'helmet', 'cors'],
              message: 'Contract files cannot import server frameworks or databases.',
            },
            {
              group: ['react', 'react-dom', 'react-native', 'expo'],
              message: 'Contract files cannot import UI frameworks.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['scripts/**/*.ts', 'src/seeds/**/*.ts', 'src/__tests__/**/*.ts', '**/*.test.ts'],
    rules: {
      'no-restricted-syntax': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
];
