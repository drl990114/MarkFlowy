import { acceptCompletion, autocompletion, startCompletion } from '@codemirror/autocomplete'
import { markdown } from '@codemirror/lang-markdown'
import { foldCode } from '@codemirror/language'
import { gotoLine, openSearchPanel } from '@codemirror/search'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { ThemeProvider } from 'styled-components'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTheme } from '../codemirror/theme'
import { basicSetup } from '../extensions/CodeMirror/setup'
import { darkTheme, lightTheme } from './index'
import { SourceCodeThemeWrapper } from './SourceCodeThemeWrapper'

const mounted: { view: EditorView; root: Root; container: HTMLElement }[] = []

function mountEditor(theme: typeof lightTheme | typeof darkTheme, doc: string) {
  const container = document.body.appendChild(document.createElement('div'))
  const root = createRoot(container)
  act(() => root.render(
    <ThemeProvider theme={theme.styledConstants}>
      <SourceCodeThemeWrapper rootFontSize='19px' rootLineHeight='1.9'>
        <div data-source-editor />
      </SourceCodeThemeWrapper>
    </ThemeProvider>,
  ))
  const view = new EditorView({
    parent: container.querySelector('[data-source-editor]')!,
    state: EditorState.create({
      doc,
      extensions: [
        basicSetup,
        markdown(),
        createTheme(theme.codemirrorTheme),
        autocompletion({
          activateOnTyping: false,
          interactionDelay: 0,
          override: [() => ({ from: 0, options: [{ label: 'alpha', type: 'variable' }] })],
        }),
      ],
    }),
  })
  mounted.push({ view, root, container })
  return view
}

function color(value: string) {
  const element = document.createElement('span')
  element.style.color = value
  return element.style.color
}

// jsdom does not implement selector specificity. Match the generated source rules
// against CodeMirror's real DOM; browser coverage verifies the final cascade.
function sourceStyle(element: Element) {
  const style = document.createElement('div').style
  for (const sheet of document.querySelectorAll<HTMLStyleElement>('style[data-styled]')) {
    for (const rule of Array.from(sheet.sheet?.cssRules ?? [])) {
      const cssRule = rule as CSSStyleRule
      if (!cssRule.selectorText || !element.matches(cssRule.selectorText)) continue
      for (let index = 0; index < cssRule.style.length; index++) {
        const property = cssRule.style[index]
        style.setProperty(property, cssRule.style.getPropertyValue(property))
      }
    }
  }
  return style
}

afterEach(() => {
  mounted.splice(0).forEach(({ view, root, container }) => {
    view.destroy()
    act(() => root.unmount())
    container.remove()
  })
})

describe.each([['light', lightTheme], ['dark', darkTheme]] as const)(
  'SourceCodeThemeWrapper %s source controls',
  (_name, theme) => {
    it('themes the actual completion popup independently of source typography', async () => {
      const view = mountEditor(theme, 'al')
      view.dispatch({ selection: { anchor: 2 } })
      view.focus()
      expect(startCompletion(view)).toBe(true)
      await vi.waitFor(() => expect(view.dom.querySelector('[role="option"]')).not.toBeNull())

      const tooltip = view.dom.querySelector<HTMLElement>('.cm-tooltip-autocomplete')!
      const selected = tooltip.querySelector<HTMLElement>('[aria-selected]')!
      expect(sourceStyle(view.dom).fontSize).toBe('19px')
      expect(sourceStyle(view.dom).lineHeight).toBe('1.9')
      expect(sourceStyle(view.dom.querySelector('.cm-activeLine')!).backgroundColor).toBe(
        color(theme.styledConstants.tipsBgColor),
      )
      expect(sourceStyle(tooltip).fontSize).toBe('13px')
      expect(sourceStyle(tooltip).backgroundColor).toBe(color(theme.styledConstants.contextMenuBgColor))
      expect(sourceStyle(selected).minHeight).toBe('28px')
      expect(sourceStyle(selected).backgroundColor).toBe(color(theme.styledConstants.contextMenuBgColorHover))
      expect(acceptCompletion(view)).toBe(true)
      expect(view.state.doc.toString()).toBe('alpha')
    })

    it('sizes native search and go-to-line controls without changing their commands', () => {
      const view = mountEditor(theme, 'first\nsecond')
      expect(openSearchPanel(view)).toBe(true)
      const panels = view.dom.querySelector<HTMLElement>('.cm-panels')!
      const search = panels.querySelector<HTMLElement>('.cm-search')!
      expect(sourceStyle(panels).fontSize).toBe('13px')
      expect(sourceStyle(panels).backgroundColor).toBe(color(theme.styledConstants.contextMenuBgColor))
      for (const control of search.querySelectorAll<HTMLElement>('.cm-textfield, .cm-button')) {
        expect(sourceStyle(control).minHeight).toBe('28px')
        expect(sourceStyle(control).backgroundColor).toBe(color(theme.styledConstants.bgColor))
        expect(sourceStyle(control).background).not.toContain('gradient')
      }

      expect(gotoLine(view)).toBe(true)
      const lineField = view.dom.querySelector<HTMLInputElement>('.cm-gotoLine input')!
      expect(sourceStyle(lineField).minHeight).toBe('28px')
      lineField.value = '2'
      lineField.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      expect(view.state.selection.main.head).toBe(6)
      expect(view.dom.querySelector('.cm-gotoLine')).toBeNull()
    })

    it('themes the fold placeholder and keeps unfolding available', () => {
      const view = mountEditor(theme, '# Heading\n\nParagraph\n\nMore content')
      expect(foldCode(view)).toBe(true)
      const placeholder = view.dom.querySelector<HTMLElement>('.cm-foldPlaceholder')!
      expect(placeholder).not.toBeNull()
      expect(sourceStyle(placeholder).backgroundColor).toBe(color(theme.styledConstants.tipsBgColor))
      expect(sourceStyle(placeholder).color).toBe(color(theme.styledConstants.primaryFontColor))
      placeholder.click()
      expect(view.dom.querySelector('.cm-foldPlaceholder')).toBeNull()
      expect(view.state.doc.toString()).toBe('# Heading\n\nParagraph\n\nMore content')
    })
  },
)
