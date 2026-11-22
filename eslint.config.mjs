import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';

export default [
  {
    ignores: ['dist/**/*', 'node_modules/**/*', '.folio-data/**/*'],
  },
  firebaseRulesPlugin.configs['flat/recommended'],
];
