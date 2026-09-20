// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs'
import { dirname, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { expect, it } from 'vitest'

const sourceRoot = fileURLToPath(new URL('../', import.meta.url))

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
  'main.tsx',
  'components/EditorArea/EditorAreaContent.tsx',
  'components/TableOfContent/TocView.tsx',
])('%s cannot reach RME through the application static import graph', (entry) => {
  const visited = new Set<string>()
  const pathsToRme: string[][] = []
  const visit = (path: string, chain: string[]) => {
    if (visited.has(path)) return
    visited.add(path)
    // Elide type-only references using the same TypeScript syntax rules as
    // transpilation, including older imports whose specifiers omit `type`.
    const { outputText } = ts.transpileModule(readFileSync(path, 'utf8'), {
      fileName: path,
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext },
    })
    const syntax = ts.createSourceFile(path + '.js', outputText, ts.ScriptTarget.Latest, true)
    for (const node of syntax.statements) {
      if (!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) continue
      if (!node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier)) continue
      const specifier = node.moduleSpecifier.text
      if (specifier === 'rme' || specifier.startsWith('rme/'))
        pathsToRme.push([...chain, path, specifier])
      const imported = resolveLocalImport(path, specifier)
      if (imported) visit(imported, [...chain, path])
    }
  }
  visit(resolve(sourceRoot, entry), [])
  expect(pathsToRme).toEqual([])
})
