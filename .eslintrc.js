module.exports = {
  'env': {
    'browser': true,
    'es6': true,
  },
  'extends': [
    'google',
  ],
  'globals': {
    'Atomics': 'readonly',
    'SharedArrayBuffer': 'readonly',
  },
  'parser': '@typescript-eslint/parser',
  'parserOptions': {
    'ecmaVersion': 11,
    'sourceType': 'module',
  },
  'plugins': [
    '@typescript-eslint',
  ],
  'rules': {
    'max-len': [
      'error',
      {
        'code': 150,
      },
    ],
    'require-jsdoc': 'off',
    'object-curly-spacing': 'off',
    'arrow-parens': 'off',
    'no-invalid-this': 'off',
  },
};
