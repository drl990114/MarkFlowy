import { PlainExtension } from "@rme-sdk/core"
import { EditorState } from "@rme-sdk/pm/state"
import { DecorationSet } from "@rme-sdk/pm/view"

import { createSelectorDecorations } from "./table-selector"

export class TableSelectorExtension extends PlainExtension {
    get name() {
        return "tableSelector"
    }

    createDecorations(state: EditorState): DecorationSet {
        return createSelectorDecorations(state)
    }
}
