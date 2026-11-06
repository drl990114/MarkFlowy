/**
 * Host contracts shared by source development and pinned-package validation.
 * Excluded from the regular Desktop suite so CI executes each contract once.
 * Editor-internal regressions belong in Capricorn's own test suite.
 */
export const capricornIntegrationTests = [
  'tests/capricorn-*.integration.test.tsx',
  'src/components/EditorArea/CapricornEditor.publishedRuntime.test.tsx',
  'src/components/EditorArea/focusActiveEditor.publishedRuntime.test.ts',
  'src/components/EditorArea/CapricornEditor.dirtyProbe.test.tsx',
  'src/components/EditorArea/capricornPublishedRuntime.test.ts',
  'src/components/EditorArea/capricornHostCompatibility.publishedRuntime.test.ts',
  'src/components/EditorArea/capricornKeybindingDefaults.publishedRuntime.test.ts',
  'src/components/EditorArea/capricornMarkdownSelection.test.ts',
  'src/components/EditorArea/capricornMarkdownSelection.largeDocument.test.ts',
  'src/components/EditorArea/capricornRuntimeDom.publishedRuntime.test.ts',
  'src/components/EditorArea/TextEditor.opening.test.tsx',
  'src/components/EditorArea/TextEditor.preview.test.tsx',
]
