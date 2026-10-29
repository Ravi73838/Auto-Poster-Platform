import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import i18nextPlugin from 'eslint-plugin-i18next';
import globals from 'globals';

export const baseConfig = [
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
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/apps/**', '../../apps/**', '../apps/**', '@ap/api', '@ap/web', '@ap/mobile'],
              message: 'Importing from apps is forbidden across all packages and apps.',
            },
          ],
        },
      ],
    },
  },
];

export const apiConfig = [
  ...baseConfig,
  {
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.name='console'][callee.property.name='log']",
          message: 'Unexpected console.log in apps/api. Use the structured logger instead.',
        },
      ],
    },
  },
];

export const reactConfig = [
  ...baseConfig,
  {
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      i18next: i18nextPlugin,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    settings: {
      react: {
        version: '18.3',
      },
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'i18next/no-literal-string': [
        'warn',
        {
          markupOnly: true,
          ignoreCallee: ['cn', 'clsx', 'cva'],
        },
      ],
    },
  },
];

export const webConfig = [
  ...reactConfig,
  {
    files: ['**/src/portals/company/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/portals/admin/**', '../admin/**', '../../admin/**', '**/admin/**'],
              message: 'portals/company must NOT import from portals/admin',
            },
            {
              group: ['**/apps/**', '../../apps/**', '../apps/**', '@ap/api', '@ap/web', '@ap/mobile'],
              message: 'Importing from apps is forbidden.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/src/portals/admin/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/portals/company/**', '../company/**', '../../company/**', '**/company/**'],
              message: 'portals/admin must NOT import from portals/company',
            },
            {
              group: ['**/apps/**', '../../apps/**', '../apps/**', '@ap/api', '@ap/web', '@ap/mobile'],
              message: 'Importing from apps is forbidden.',
            },
          ],
        },
      ],
    },
  },
];

export const reactNativeConfig = [
  ...reactConfig,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      'i18next/no-literal-string': [
        'warn',
        {
          markupOnly: true,
        },
      ],
    },
  },
];

export default baseConfig;
