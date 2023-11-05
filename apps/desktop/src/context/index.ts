import type { MF_CONTEXT } from '@markflowy/types'
import * as editor from './editor'
import * as theme from './theme'

const __MF__: MF_CONTEXT = Object.freeze({
  editor,
  theme
})

export default __MF__
