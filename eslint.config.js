import js from '@eslint/js';
import stylisticJs from '@stylistic/eslint-plugin-js';
import globals from 'globals';

export default [
    {
        files: ['**/*.{js}'],
        languageOptions: {
            ecmaVersion: 2020,
            globals: globals.browser,
            parserOptions: {
                ecmaVersion: 'latest',
                ecmaFeatures: {jsx: false},
            },
        },
        rules: {...js.configs.recommended.rules},
    },

    {
        plugins: {'@stylistic/js': stylisticJs},
        rules: {
            'max-len': [2, 80],
            'indent': [2, 4],
            'linebreak-style': [2, 'unix'],
            'quotes': [2, 'single'],
            'semi': [2, 'always'],
            'comma-dangle': [2, 'always-multiline'],
            'no-unused-vars': 1,
            'object-curly-spacing': [2, 'never'],
            'array-bracket-spacing': [2, 'never'],
            'keyword-spacing': 2,
        },
    },
];
