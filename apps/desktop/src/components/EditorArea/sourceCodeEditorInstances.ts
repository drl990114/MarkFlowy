import type { MfCodemirrorView } from 'rme'

// Reading an existing source selection must not load the source editor/search engine.
export const sourceCodeCodemirrorViewMap = new Map<string, MfCodemirrorView>()
