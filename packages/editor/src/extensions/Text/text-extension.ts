import { TextExtension } from "remirror/extensions"
import type Token from "markdown-it/lib/token"

import type { NodeSerializerOptions} from "../../transform"
import { ParserRuleType } from "../../transform"

export class LineTextExtension extends TextExtension {
    fromMarkdown() {
        return [
            {
                type: ParserRuleType.text,
                token: "text",
                getText: (tok: Token) => tok.content,
            },
            {
                type: ParserRuleType.text,
                token: "inline",
                getText: (tok: Token) => tok.content,
            },
            {
                type: ParserRuleType.text,
                token: "softbreak",
                getText: (tok: Token) => "\n",
            },
        ] as const
    }

    toMarkdown({ state, node }: NodeSerializerOptions) {
        state.text(node.text || "")
    }
}
