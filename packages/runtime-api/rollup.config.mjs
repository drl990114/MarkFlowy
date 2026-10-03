import { readFileSync } from 'fs'
import { createConfig } from '../../rollup.config.mjs'

export default createConfig({
  input: 'src/index.ts',
  pkg: JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')),
}).map((config) => ({
  ...config,
  onwarn(warning, defaultHandler) {
    // The retired executable theme API intentionally keeps an empty compatibility entry.
    if (warning.code === 'EMPTY_BUNDLE') return
    config.onwarn(warning, defaultHandler)
  },
}))
