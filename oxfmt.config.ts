import { defineConfig } from 'oxfmt';

export default defineConfig({
  ignorePatterns: ['dist/**'],
  printWidth: 100,
  semi: true,
  singleQuote: true,
  trailingComma: 'all',
  arrowParens: 'always',
  bracketSpacing: true,
  bracketSameLine: false,
  useTabs: false,
  sortTailwindcss: {},
  sortImports: {
    internalPattern: ['~', '@/'],
    sortSideEffects: true,
    customGroups: [
      {
        groupName: 'pkg-chain-tail',
        modifiers: ['side_effect'],
        // elementNamePattern: ['@packages/**', '@features/**'],
      },
      {
        groupName: 'relative-style-tail',
        selector: 'style',
        elementNamePattern: ['../**', './**'],
      },
      {
        groupName: 'relative-side-tail',
        modifiers: ['side_effect'],
        elementNamePattern: ['../**', './**'],
      },
      {
        groupName: 'mono-pkg',
        elementNamePattern: ['@packages/**', '@features/**'],
      },
    ],
    groups: [
      ['value-builtin', 'value-external'],
      'mono-pkg',
      'value-internal',
      ['value-parent', 'value-sibling', 'value-index'],
      ['type-parent', 'type-sibling', 'type-index'],
      ['type-import', 'type-internal'],
      ['pkg-chain-tail', 'relative-style-tail', 'relative-side-tail'],
      'unknown',
    ],
    newlinesBetween: true,
  },
  sortPackageJson: {
    sortScripts: false,
  },
});
