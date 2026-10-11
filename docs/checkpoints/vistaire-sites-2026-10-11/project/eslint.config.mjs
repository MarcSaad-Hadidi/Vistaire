import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
export default [
 { ignores: ['node_modules/**', 'dist/**', 'artifacts/**', 'test-results/**', 'public/**', 'scripts/cinematic/**'] },
 { files: ['src/**/*.{js,jsx}'], languageOptions: { ecmaVersion: 'latest', sourceType: 'module', parserOptions: { ecmaFeatures: { jsx: true } }, globals: globals.browser }, plugins: {'react-hooks': reactHooks}, rules: {...js.configs.recommended.rules, 'no-unused-vars': ['error', {varsIgnorePattern:'^[A-Z]', argsIgnorePattern:'^_'}], 'react-hooks/rules-of-hooks': 'error'} }
];
