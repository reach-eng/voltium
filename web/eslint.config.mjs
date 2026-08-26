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
      // TypeScript rules � keep practical ones enabled
      '@typescript-eslint/no-explicit-any': 'off', // pragmatic for repositories and handlers
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off', // pragmatic for API responses
      '@typescript-eslint/ban-ts-comment': 'off', // needed for edge cases
      '@typescript-eslint/prefer-as-const': 'off',

      // React rules
      'react-hooks/exhaustive-deps': 'off',
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
      'react/no-unescaped-entities': 'off',
      'react/display-name': 'off',
      'react/prop-types': 'off',

      // Next.js rules
      '@next/next/no-img-element': 'off',
      '@next/next/no-html-link-for-pages': 'off',

      // General JavaScript rules
      'prefer-const': 'off',
      'no-unused-vars': 'off',
      'no-console': 'off',
      'no-debugger': 'warn',
      'no-empty': 'off',
      'no-irregular-whitespace': 'off',
      'no-case-declarations': 'off',
      'no-fallthrough': 'off',
      'no-mixed-spaces-and-tabs': 'error',
      'no-redeclare': 'off',
      'no-undef': 'off',
      'no-unreachable': 'warn',
      'no-useless-escape': 'off',
    },
  },
  {
    // W5 / F-061 ratchet: admin route handlers must not import the shared
    // Prisma client � business logic belongs in server/modules use-cases.
    // Existing violations are enumerated in docs/REMEDIATION_PLAN_2026-08-21.md
    // (F-061 follow-up); this rule guarantees NO NEW ones appear.
    files: ['src/app/api/admin/**/route.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@/lib/db',
              message:
                'Admin routes must not import db directly. Move data access into a use-case under src/server/modules/ (F-061).',
            },
          ],
        },
      ],
    },
  },
  {
    // W5 / F-061 DEBT LIST � pre-existing violations frozen by the ratchet
    // above. Each entry removed as its route migrates to a use-case.
    // DO NOT ADD FILES HERE.
    files: [
      'src/app/api/admin/admins/lookup/route.ts',
      'src/app/api/admin/auth/refresh/route.ts',
      'src/app/api/admin/data-management/overview/route.ts',
      'src/app/api/admin/dr-drill/route.ts',
      'src/app/api/admin/jobs/route.ts',
      'src/app/api/admin/maintenance-mode/route.ts',
      'src/app/api/admin/operations/overview/route.ts',
      'src/app/api/admin/payment-gateways/\\[id\\]/route.ts',
      'src/app/api/admin/payment-gateways/\\[id\\]/test-connection/route.ts',
      'src/app/api/admin/payment-gateways/route.ts',
      'src/app/api/admin/rentals/book-on-behalf/route.ts',
      'src/app/api/admin/riders/\\[id\\]/data-deletion/approve/route.ts',
      'src/app/api/admin/riders/\\[id\\]/data-deletion/restore/route.ts',
      'src/app/api/admin/riders/\\[id\\]/data-deletion/route.ts',
      'src/app/api/admin/riders/\\[id\\]/route.ts',
      'src/app/api/admin/riders/\\[id\\]/wallet-adjust/route.ts',
      'src/app/api/admin/system-settings/route.ts',
      'src/app/api/admin/team-leaders/\\[id\\]/riders/route.ts',
      'src/app/api/admin/team-leaders/bulk/undo/route.ts',
      'src/app/api/admin/tickets/\\[id\\]/messages/route.ts',
      'src/app/api/admin/transactions/bulk/route.ts',
      'src/app/api/admin/vehicles/\\[id\\]/history/route.ts',
      'src/app/api/admin/workflow-coverage/route.ts',
    ],
    rules: {
      'no-restricted-imports': 'off',
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
      '@typescript-eslint/no-unused-vars': 'off',
      'no-console': 'off',
    },
  },
  {
    files: ['scripts/**/*.ts', 'scripts/**/*.js', 'scripts/**/*.mjs'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
      'coverage/**',
      'coverage',
      'dist/**',
      'next-env.d.ts',
      'examples/**',
      'skills',
      'scratch/**',
      'flutter/**',
      'android/**',
      'tests/load/**',
      'tests/generate-tests.js',
      'test-profile.ts',
      'script.js',
      'approve_rider.ts',
      'check.ts',
      'scripts/**',
      '*.js',
      '*.mjs',
      '*.cjs',
      '*.ts',
      'public/**',
    ],
  },
  {
    // Next.js App Router uses src/app/layout.tsx, not pages/_document.js.
    // The no-page-custom-font rule is a false positive for the App Router
    // when the only <link rel="stylesheet"> in <head> targets Google Fonts.
    files: ['src/app/layout.tsx'],
    rules: {
      '@next/next/no-page-custom-font': 'off',
    },
  },
  {
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
];

export default eslintConfig;
