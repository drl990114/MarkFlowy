import { HorizontalRuleExtension } from 'remirror/extensions'

import type { NodeSerializerOptions} from '../../transform'
import { ParserRuleType } from '../../transform'

export class LineHorizontalRuleExtension extends HorizontalRuleExtension {
  fromMarkdown() {
    return [
      {
        type: ParserRuleType.block,
        token: 'hr',
        node: this.name,
        hasOpenClose: false,
      },
    ] as const
  }
  toMarkdown({ state, node }: NodeSerializerOptions) {
    state.write('---')
    state.closeBlock(node)
  }
}
