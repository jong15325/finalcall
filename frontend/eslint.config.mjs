// @ts-check

import { fixupConfigRules } from '@eslint/compat'
import reactRefresh from 'eslint-plugin-react-refresh'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import js from '@eslint/js'
import { FlatCompat } from '@eslint/eslintrc'
import tseslint from 'typescript-eslint'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all,
})

export default tseslint.config(
    [
        {
            ignores: [
                '**/build/',
                '**/node_modules/',
                '**/dist/',
                '**/.prettierrc.js',
                '**/.eslintrc.js',
                '**/env.d.ts',
                '**/eslint.config.mjs',
                '**/postcss.config.cjs',
                '**/tailwind.config.cjs',
            ],
        },
        ...fixupConfigRules(
            compat.extends(
                'eslint:recommended',
                'plugin:import/recommended',
                'plugin:react/recommended',
                'plugin:react-hooks/recommended',
                'prettier',
                'eslint-config-prettier',
            ),
        ),
        {
            plugins: {
                'react-refresh': reactRefresh,
            },

            settings: {
                react: {
                    version: 'detect',
                },

                'import/parsers': {
                    '@typescript-eslint/parser': ['.ts', '.tsx'],
                },

                'import/resolver': {
                    typescript: {
                        project: './tsconfig.eslint.json',
                        alwaysTryTypes: true,
                    },
                },
            },
            rules: {
                'react-refresh/only-export-components': [
                    'warn',
                    {
                        allowConstantExport: true,
                    },
                ],
                'react-hooks/rules-of-hooks': 'off',
                'react/react-in-jsx-scope': 'off',
                'import/first': 'warn',
                'import/default': 'off',
                'import/newline-after-import': 'warn',
                'import/no-named-as-default-member': 'off',
                'import/no-duplicates': 'error',
                'import/no-named-as-default': 0,
                'react/prop-types': 'off',
                'react/jsx-sort-props': [
                    'warn',
                    {
                        callbacksLast: true,
                        shorthandFirst: true,
                        ignoreCase: true,
                        reservedFirst: true,
                        noSortAlphabetically: true,
                    },
                ],
            },
        },
    ],
    tseslint.configs.recommended,
    {
        languageOptions: {
            parserOptions: {
                // 루트 설정 파일(vite/vitest.config.ts)은 tsconfig.node.json 이 잡는다.
                // 빌드 스크립트는 .mjs 라 tsconfig(allowJs:false)에 들어갈 수 없으므로
                // 기본 프로젝트로 흘린다 — 타입 정보가 필요한 파일이 아니다.
                projectService: {
                    allowDefaultProject: ['scripts/*.mjs'],
                },
                tsconfigRootDir: import.meta.dirname,
            },
        },
    },
    {
        files: ['**/*.tsx', '**/*.ts'],
        rules: {
            '@typescript-eslint/no-unused-expressions': 'off',
        },
    },
    {
        // 빌드 스크립트는 브라우저가 아니라 Node 에서 돈다(아트 동기화 등).
        // eslint:recommended 의 no-undef 가 console/process 를 모르는 걸 여기서 풀어준다.
        files: ['scripts/**/*.mjs'],
        languageOptions: {
            globals: {
                console: 'readonly',
                process: 'readonly',
            },
        },
    },
)
