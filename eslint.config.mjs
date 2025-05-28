import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
  js.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    rules: {
      // Basic security rules for JS files
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
      'no-console': 'warn',
      'no-debugger': 'error',
      'no-alert': 'error',
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: ['./src/tsconfig.json', './webview-ui/tsconfig.json'],
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      // Security Rules
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
      'no-unsafe-finally': 'error',
      'no-unsafe-negation': 'error',

      // Prevent sensitive data exposure
      'no-console': 'warn', // Warn about console.log in production
      'no-debugger': 'error',
      'no-alert': 'error',

      // TypeScript Security Rules
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',

      // Prevent common security issues
      'no-unused-vars': 'off', // Use TypeScript version instead
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }],

      // Code Quality Rules
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',

      // Best Practices
      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      'prefer-template': 'error',

      // Security-focused rules for Flow Provider
      'no-prototype-builtins': 'error',
      'no-constructor-return': 'error',
      'no-promise-executor-return': 'error',
      'no-unreachable-loop': 'error',
      'require-atomic-updates': 'error',
    },
  },
  {
    // Specific rules for Flow Provider files
    files: ['src/api/providers/flow/**/*.ts'],
    rules: {
      // Stricter rules for Flow Provider security
      'no-console': 'error', // No console.log in Flow Provider
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': 'warn',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
    },
  },
  {
    // Test files can be more lenient
    files: ['**/*.test.{js,ts,tsx}', '**/__tests__/**/*.{js,ts,tsx}'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },
  {
    // Ignore patterns
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'out/**',
      '**/*.d.ts',
      'src/dist/**',
      'webview-ui/build/**',
    ],
  },
];
