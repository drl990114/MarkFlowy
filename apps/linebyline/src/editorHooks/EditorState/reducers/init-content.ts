import { EditorState } from "@linebyline/editor/types"

export type EditorInitAction = {
    type: "INIT_ACTION",
    payload: {
        content: string
    }
}

export function initEditor(state: EditorState, action: EditorInitAction): EditorState {

    return { ...state, note: { content: action?.payload?.content , deleted: false}, loaded: true }
}