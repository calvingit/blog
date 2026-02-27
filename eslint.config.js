import antfu from '@antfu/eslint-config'

export default antfu({
  stylistic: {
    indent: 2,
    quotes: 'single',
    semi: false,
  },
  formatters: true,
  astro: true,
  typescript: true,
  rules: {
    'node/prefer-global/process': 'off',
  },
})
