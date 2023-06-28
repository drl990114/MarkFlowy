import { BlockquoteExtension } from "remirror/extensions"

import type { NodeSerializerOptions} from "../../transform"
import { ParserRuleType } from "../../transform"

export class LineBlockquoteExtension extends BlockquoteExtension {
    public fromMarkdown() {
        return [
            {
                type: ParserRuleType.block,
                token: "blockquote",
                node: this.name,
                hasOpenClose: true,
            },
        ] as const
    }

    public toMarkdown({ state, node }: NodeSerializerOptions) {
        state.wrapBlock("> ", null, node, () => state.renderContent(node))
    }
}
