import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // TypeScript rules — keep practical ones enabled
      '@typescript-eslint/no-explicit-any': 'warn', // too many legitimate uses
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-non-null-assertion': 'off', // pragmatic for API responses
      '@typescript-eslint/ban-ts-comment': 'off', // needed for edge cases
      '@typescript-eslint/prefer-as-const': 'warn',
      // '@typescript-eslint/no-unused-disable-directives'(plural) in v8+

      // React rules
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/purity': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/rules-of-hooks': 'off',
      'react-hooks/static-components': 'off',
      'react-hooks/use-memo': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/incompatible-library': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/globals': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/error-boundaries': 'off',
      'react-hooks/set-state-in-render': 'off',
      'react-hooks/unsupported-syntax': 'off',
      'react-hooks/config': 'off',
      'react-hooks/gating': 'off',
      'react-compiler/react-compiler': 'off',
      'react/no-unescaped-entities': 'warn',
      'react/display-name': 'off',
      'react/prop-types': 'off',

      // Next.js rules
      '@next/next/no-img-element': 'warn',
      '@next/next/no-html-link-for-pages': 'off',

      // General JavaScript rules — these matter
      'prefer-const': 'warn',
      'no-unused-vars': 'off', // covered by @typescript-eslint/no-unused-vars
      'no-console': 'warn',
      'no-debugger': 'warn',
      'no-empty': 'warn',
      'no-irregular-whitespace': 'warn',
      'no-case-declarations': 'warn',
      'no-fallthrough': 'warn',
      'no-mixed-spaces-and-tabs': 'error',
      'no-redeclare': 'warn',
      'no-undef': 'warn',
      'no-unreachable': 'warn',
      'no-useless-escape': 'warn',
    },
  },
  {
    files: ['tests/unit/**/*.ts', 'tests/unit/**/*.tsx', 'tests/**/*.test.ts', 'tests/**/*.ts'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        test: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        vi: 'readonly',
        RequestInit: 'readonly',
        HeadersInit: 'readonly',
        Response: 'readonly',
        Request: 'readonly',
        console: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
      'dist/**',
      'next-env.d.ts',
      'examples/**',
      'skills',
      'scratch/**',
      'flutter/**',
      'android/**',
    ],
  },
];

export default eslintConfig;
