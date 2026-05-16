import { extension, PlainExtension, PrioritizedKeyBindings } from '@rme-sdk/core'
import { arrowHandler } from '../CodeMirror/codemirror-utils'

type ClipboardExtensionOptions = {}

@extension<ClipboardExtensionOptions>({
  defaultOptions: {},
  staticKeys: [],
  handlerKeys: [],
  customHandlerKeys: [],
})
export class CommonKeymapExtension extends PlainExtension<ClipboardExtensionOptions> {
  get name() {
    return 'commonKeymap' as const
  }

  createKeymap(): PrioritizedKeyBindings {
    return {
      ArrowLeft: arrowHandler('left'),
      ArrowRight: arrowHandler('right'),
      ArrowUp: arrowHandler('up'),
      ArrowDown: arrowHandler('down'),
    }
  }
}
