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
      '@typescript-eslint/no-explicit-any': 'off',          // too many legitimate uses
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-non-null-assertion': 'off',     // pragmatic for API responses
      '@typescript-eslint/ban-ts-comment': 'off',            // needed for edge cases
      '@typescript-eslint/prefer-as-const': 'warn',
      // '@typescript-eslint/no-unused-disable-directives'(plural) in v8+

      // React rules
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/purity': 'off',
      'react/no-unescaped-entities': 'warn',
      'react/display-name': 'off',
      'react/prop-types': 'off',
      'react-compiler/react-compiler': 'warn',

      // Next.js rules
      '@next/next/no-img-element': 'warn',
      '@next/next/no-html-link-for-pages': 'off',

      // General JavaScript rules — these matter
      'prefer-const': 'warn',
      'no-unused-vars': 'off',  // covered by @typescript-eslint/no-unused-vars
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
      'tests/**',
    ],
  },
];

export default eslintConfig;
