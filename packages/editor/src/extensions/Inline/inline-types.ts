import type { LineMarkAttrs, LineMarkName } from "./inline-mark-extensions"

export enum InlineDecorateType {
    Ignore = "IGNORE",
}

export interface InlineToken {
    marks: LineMarkName[]

    // Only for debugging
    text?: string

    // start position
    start: number
    // end position
    end: number

    attrs: LineMarkAttrs
}
