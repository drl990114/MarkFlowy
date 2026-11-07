// @vitest-environment jsdom
// Load the actual package before the renderer wait deadlines start.
import 'virtual:markflowy-capricorn-runtime'
import { cleanup, render, waitFor } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import postcss from 'postcss'
import { parseThemeDocument, resolveTheme } from '@markflowy/theme/semantic'
import { CapricornEditor } from '@/components/EditorArea/CapricornEditor'
import { cssSnippetTemplates } from '@/themes/cssSnippetTemplates'
import { PreviewSurface } from '@/themes/preview/PreviewSurface'

vi.mock('@/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  i18n: { language: 'en', dir: () => 'ltr', on: () => {}, off: () => {}, t: (key: string) => key },
}))

const rangeGeometry = ['getClientRects', 'getBoundingClientRect'].map(
  (name) => [name, Object.getOwnPropertyDescriptor(Range.prototype, name)] as const,
)
beforeAll(() => {
  // Only geometry is stubbed; selectors and rendered Markdown come from the package.
  Object.defineProperties(Range.prototype, {
    getClientRects: { configurable: true, value: () => [] },
    getBoundingClientRect: { configurable: true, value: () => new DOMRect() },
  })
})
afterEach(cleanup)
afterAll(() => {
  rangeGeometry.forEach(([name, descriptor]) => {
    if (descriptor) Object.defineProperty(Range.prototype, name, descriptor)
    else Reflect.deleteProperty(Range.prototype, name)
  })
})

const markdown = [
  '# Heading one',
  '## Heading two',
  '> Quoted words.',
  '- [x] Completed **parent** with `code` and [a link](https://markflowy.com).\n  - [ ] Incomplete child.\n- [ ] Incomplete parent.\n  - [x] Completed child.',
  '| Detail | Value |\n| --- | --- |\n| Theme | Personal |',
].join('\n\n')

const documentTheme = parseThemeDocument({
  version: 1,
  id: 'css-contract',
  name: 'CSS contract',
  variants: [{ id: 'light', name: 'Light', mode: 'light', tokens: {} }],
})
const theme = resolveTheme(documentTheme, documentTheme.variants[0])
const previewLabels = {
  preview: 'Preview',
  loadError: 'Failed',
  error: 'Error',
  retry: 'Retry',
  previewNotes: 'Notes',
  previewIdeas: 'Ideas',
  previewWelcome: 'Welcome',
  previewSearch: 'Search preview',
  previewSearchPlaceholder: 'Search…',
  previewNewNote: 'New note',
}

function selectorsFor(css: string) {
  const selectors: string[] = []
  postcss.parse(css).walkRules((rule) => {
    selectors.push(...rule.selectors)
  })
  expect(selectors.length).toBeGreaterThan(0)
  return selectors
}

describe('personal CSS templates against the published Capricorn DOM', () => {
  it.each(['edit', 'preview', 'customization'] as const)(
    'matches the intended document elements only in the %s surface',
    async (surface) => {
      const errors = vi.fn()
      const view = render(
        surface === 'customization' ? (
          <PreviewSurface
            theme={theme}
            snippets={cssSnippetTemplates}
            inspect={false}
            labels={previewLabels}
            onInspect={vi.fn()}
          />
        ) : (
          <CapricornEditor
            active={false}
            visible
            initialMarkdown={markdown}
            options={{ mode: surface, virtualize: { enable: false } }}
            onChange={vi.fn()}
            onError={errors}
            onUnavailable={errors}
          />
        ),
      )
      const content = await waitFor(
        () => {
          const root = view.container.querySelector<HTMLElement>(
            '.mf-editor-content[data-mf-capricorn-runtime] > [data-cap-content]',
          )
          expect(root).not.toBeNull()
          expect(root!.querySelectorAll('.capricorn-markdown-task-checkbox')).toHaveLength(4)
          expect(
            root!.querySelector(
              '.capricorn-markdown-table-cell, .capricorn-markdown-inline-table-cell',
            ),
          ).not.toBeNull()
          return root!
        },
        { timeout: 15000 },
      )

      // Identical renderer markup outside the public scope must remain untouched.
      const outside = content.cloneNode(true) as HTMLElement
      view.container.append(outside)
      for (const template of cssSnippetTemplates) {
        for (const selector of selectorsFor(template.css)) {
          const matches = [...document.querySelectorAll(selector)]
          expect(matches.length, `${template.id} should match ${surface}`).toBeGreaterThan(0)
          expect(matches.every((element) => content.contains(element)), selector).toBe(true)
          expect(outside.querySelectorAll(selector), `${template.id} escaped its scope`).toHaveLength(0)
          if (template.id === 'heading-dividers') {
            expect(matches).toEqual([...content.querySelectorAll('h1, h2')])
          }
          if (template.id === 'compact-tables') {
            expect(matches.map((cell) => cell.textContent)).toEqual([
              'Detail',
              'Value',
              'Theme',
              'Personal',
            ])
          }
          if (template.id === 'quote-accent') {
            expect(matches).toHaveLength(1)
            expect(matches[0].textContent).toBe(
              surface === 'customization' ? 'A theme should support the words.' : 'Quoted words.',
            )
          }
        }
      }

      const completed = cssSnippetTemplates.find((template) => template.id === 'completed-tasks')!
      const [completedSelector] = selectorsFor(completed.css)
      const checkboxes = [
        ...content.querySelectorAll<HTMLInputElement>('.capricorn-markdown-task-checkbox'),
      ]
      // Both nesting directions are deliberate: completed parent / incomplete child,
      // then incomplete parent / completed child. Descendant :has() is too broad.
      expect(checkboxes.map((checkbox) => checkbox.checked)).toEqual([true, false, false, true])
      const completedContents: Element[] = []
      for (const checkbox of checkboxes) {
        const item = checkbox.closest('.capricorn-markdown-list-item')!
        const text = item.querySelector(':scope > .capricorn-markdown-list-content')!
        expect(text).not.toBeNull()
        // Text decoration must not propagate into a nested task through this content node.
        expect(text.querySelector('.capricorn-markdown-list-item')).toBeNull()
        expect(text.matches(completedSelector), item.textContent ?? '').toBe(checkbox.checked)
        if (checkbox.checked) completedContents.push(text)
      }
      expect([...content.querySelectorAll(completedSelector)]).toEqual(completedContents)
      expect(view.container.querySelector('[role="alert"]')).toBeNull()
      expect(errors).not.toHaveBeenCalled()
    },
    30000,
  )
})
