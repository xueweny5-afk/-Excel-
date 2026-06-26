// ESLint 9 flat config
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  // 全局忽略
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'node_modules/**',
      '*.tsbuildinfo',
      'eslint.config.js',
      'vitest.config.ts',
    ],
  },

  // 基础 JS 推荐规则
  js.configs.recommended,

  // TypeScript 推荐规则
  ...tseslint.configs.recommended,

  // React Hooks 规则
  {
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },

  // 项目特定配置
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        URL: 'readonly',
        Blob: 'readonly',
        File: 'readonly',
        FileReader: 'readonly',
        CustomEvent: 'readonly',
        DragEvent: 'readonly',
        ReactNode: 'readonly',
        location: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
      },
    },
    rules: {
      // TypeScript 宽松规则
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-non-null-assertion': 'off',

      // React Hooks
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // 通用
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
    },
  },

  // 测试文件宽松规则
  {
    files: ['**/__tests__/**/*.ts', '**/*.test.ts', '**/*.test.tsx', 'src/test/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },
];
