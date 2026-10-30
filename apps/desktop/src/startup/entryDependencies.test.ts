// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs'
import { dirname, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { expect, it } from 'vitest'

const sourceRoot = fileURLToPath(new URL('../', import.meta.url))
const staticImportsByPath = new Map<string, string[]>()

function getStaticImports(path: string): string[] {
  const cached = staticImportsByPath.get(path)
  if (cached) return cached

  // Elide type-only references using the same TypeScript syntax rules as
  // transpilation, including older imports whose specifiers omit `type`.
  const { outputText } = ts.transpileModule(readFileSync(path, 'utf8'), {
    fileName: path,
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext },
  })
  const syntax = ts.createSourceFile(path + '.js', outputText, ts.ScriptTarget.Latest, true)
  const specifiers: string[] = []
  for (const node of syntax.statements) {
    if (!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) continue
    if (!node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier)) continue
    specifiers.push(node.moduleSpecifier.text)
  }
  // Entry graphs overlap; transform each source once while keeping traversal
  // state and forbidden-import checks independent for each entry.
  staticImportsByPath.set(path, specifiers)
  return specifiers
}

function resolveLocalImport(importer: string, specifier: string) {
  const base = specifier.startsWith('@/')
    ? resolve(sourceRoot, specifier.slice(2))
    : specifier.startsWith('.')
      ? resolve(dirname(importer), specifier)
      : undefined
  if (!base) return undefined
  return [
    base,
    ...['.ts', '.tsx', '.js', '/index.ts', '/index.tsx', '/index.js'].map(
      (suffix) => base + suffix,
    ),
  ].find((path) => ['.ts', '.tsx', '.js'].includes(extname(path)) && existsSync(path))
}

/** Source-level boundary guard, not evidence of production chunk size or timing. */
it.each([
  ['main.tsx', /^(rme(?:\/|$)|@codemirror\/|react-markdown$|remark-gfm$)/],
  ['components/EditorArea/EditorAreaContent.tsx', /^rme(?:\/|$)/],
  ['components/TableOfContent/TocView.tsx', /^rme(?:\/|$)/],
] as const)('%s keeps optional editor/rendering engines outside its static import graph', { timeout: 30_000 }, (entry, forbidden) => {
  const visited = new Set<string>()
  const forbiddenPaths: string[][] = []
  const visit = (path: string, chain: string[]) => {
    if (visited.has(path)) return
    visited.add(path)
    for (const specifier of getStaticImports(path)) {
      if (forbidden.test(specifier))
        forbiddenPaths.push([...chain, path, specifier])
      const imported = resolveLocalImport(path, specifier)
      if (imported) visit(imported, [...chain, path])
    }
  }
  visit(resolve(sourceRoot, entry), [])
  expect(forbiddenPaths).toEqual([])
})
