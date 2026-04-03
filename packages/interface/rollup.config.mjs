import { readFileSync } from 'fs'
import { createConfig } from '../../rollup.config.mjs'

export default createConfig({
  input: 'src/index.ts',
  pkg: JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')),
})
