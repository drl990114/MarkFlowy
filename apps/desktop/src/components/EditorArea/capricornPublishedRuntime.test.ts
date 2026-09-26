import { act, fireEvent, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { isCapricornRuntimeAvailable } from '@/constants/editorViewType'
import { createCapricornRuntime } from 'virtual:markflowy-capricorn-runtime'

import {
  CAPRICORN_DESKTOP_VIRTUALIZE_OPTIONS,
  createCapricornRuntimeAdapter,
  type CapricornInlineEditRequest,
  type CapricornRuntimeFactory,
  type CapricornRuntimeSession,
} from './capricornRuntimeAdapter'
import { getCapricornRuntimeInput } from './capricornRuntimeDom'

let session: CapricornRuntimeSession | undefined
const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

afterEach(() => {
  act(() => session?.destroy())
  session = undefined
  document.body.replaceChildren()
})

describe.skipIf(!isCapricornRuntimeAvailable)('published Capricorn runtime', () => {
  it('constructs and mounts through the same virtual module used by Desktop', () => {
    const container = document.createElement('div')
    document.body.append(container)

    expect(CAPRICORN_DESKTOP_VIRTUALIZE_OPTIONS).toEqual({
      bufferRange: 1800,
      enable: true,
      enableScrollAnchoring: true,
      firstPaintBlockSize: 96,
    })

    session = (createCapricornRuntime as CapricornRuntimeFactory)(container, {
      markdown: '# Capricorn',
      mode: 'edit',
      virtualize: CAPRICORN_DESKTOP_VIRTUALIZE_OPTIONS,
    })

    expect(session.getMarkdown()).toBe('# Capricorn')
    expect(container.childElementCount).toBeGreaterThan(0)
  })

  it('shows nested HTML tags on focus and restores native ruby presentation on blur and preview', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const original =
      'H<sub>2</sub>O <mark><ruby>漢字<rp>(</rp><rt>かんじ</rt><rp>)</rp></ruby></mark>'
    await act(async () => {
      session = (createCapricornRuntime as CapricornRuntimeFactory)(container, {
        markdown: original,
        mode: 'edit',
        autoFocus: false,
        virtualize: CAPRICORN_DESKTOP_VIRTUALIZE_OPTIONS,
      })
    })
    const runtime = session!
    const markers = () => container.querySelectorAll('[data-markdown-mark-marker].show')
    expect(container.querySelector('mark > ruby > rt')).not.toBeNull()
    expect(container.querySelectorAll('ruby > rp')).toHaveLength(2)
    expect(container.querySelector('sub')?.textContent).toBe('2')
    expect(markers()).toHaveLength(0)
    await act(async () => {
      await runtime.find.searchAsync!({ query: '漢字' })
      await runtime.find.navigateTo!(0)
      runtime.find.close()
      runtime.focus()
      await frame()
    })
    expect(Array.from(markers(), (node) => node.textContent)).toEqual([
      '<mark>',
      '<ruby>',
      '<rp>',
      '</rp>',
      '<rt>',
      '</rt>',
      '<rp>',
      '</rp>',
      '</ruby>',
      '</mark>',
    ])
    expect(container.querySelector('ruby[data-markdown-html-source-visible]')).not.toBeNull()
    expect(runtime.getMarkdown()).toBe(original)
    expect(runtime.getUiState().canUndo).toBe(false)
    await act(async () => {
      getCapricornRuntimeInput(container)!.blur()
      await frame()
    })
    expect(markers()).toHaveLength(0)
    expect(container.querySelector('ruby[data-markdown-html-source-visible]')).toBeNull()
    await act(async () => runtime.setMode('preview'))
    expect(container.querySelector('mark > ruby > rt')).not.toBeNull()
    expect(markers()).toHaveLength(0)
    expect(runtime.getMarkdown()).toBe(original)
  })

  it('edits ruby source tags through the host input and preserves save, undo and redo', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const original = '<mark><ruby>漢<rt>かん</rt></ruby></mark>'
    await act(async () => {
      session = (createCapricornRuntime as CapricornRuntimeFactory)(container, {
        markdown: original,
        mode: 'edit',
        autoFocus: false,
      })
      await session.find.searchAsync!({ query: '<ruby>' })
      await session.find.navigateTo!(0)
      session.find.close()
      session.focus()
      await frame()
    })
    const runtime = session!
    const input = getCapricornRuntimeInput(container)!
    expect(document.activeElement).toBe(input)
    for (const character of '<ruby lang="ja">') {
      await act(async () => {
        fireEvent.input(input, {
          target: { value: input.value + character },
          inputType: 'insertText',
          data: character,
        })
      })
    }
    const edited = original.replace('<ruby>', '<ruby lang="ja">')
    expect(container.querySelector('mark > ruby')?.getAttribute('lang')).toBe('ja')
    expect(runtime.getMarkdown()).toBe(edited)
    await act(async () => runtime.commands.undo())
    expect(runtime.getMarkdown()).toBe(original)
    await act(async () => runtime.commands.redo())
    expect(runtime.getMarkdown()).toBe(edited)
    expect(container.querySelector('mark > ruby')?.getAttribute('lang')).toBe('ja')
  })

  it('edits images through the Desktop adapter and preserves source snapshots and undo', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const onChange = vi.fn()
    const onEdit = vi.fn<(request: CapricornInlineEditRequest | null) => void>()
    const original = '![Original](./original.png)'
    const adapter = createCapricornRuntimeAdapter({
      container,
      createRuntime: createCapricornRuntime as CapricornRuntimeFactory,
      onChange,
      options: { markdown: original, mode: 'edit' },
    })
    const unsubscribe = adapter.subscribeInlineEdit!(onEdit)
    try {
      await act(async () => container.querySelector('img')!.click())
      const request = onEdit.mock.lastCall?.[0]
      expect(request?.kind).toBe('image')
      expect(request?.bookmark.image?.src).toBe('./original.png')
      if (!request?.bookmark.image) throw new Error('The published image edit API is missing.')
      const { bookmark } = request
      expect(adapter.selection?.restore(bookmark.id)).toBe(true)
      await act(async () => {
        adapter.commands.updateImage!(bookmark.image!.key, {
          src: './replacement.png',
          alt: 'Updated description',
        })
      })
      expect(adapter.getMarkdown()).toBe('![Updated description](./replacement.png)')
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ documentChanged: true }))
      expect(adapter.selection?.isValid(bookmark.id)).toBe(false)
      await act(async () => adapter.commands.undo())
      expect(adapter.getMarkdown()).toBe(original)
      await act(async () => adapter.commands.redo())
      expect(adapter.getMarkdown()).toBe('![Updated description](./replacement.png)')
      await act(async () => adapter.setMarkdown('Another document'))
      expect(adapter.selection?.restore(bookmark.id)).toBe(false)
    } finally {
      unsubscribe()
      act(() => adapter.destroy())
    }
  })

  it('dispatches link navigation only from the hover button in the published package', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const handleLinkClick = vi.fn()
    await act(async () => {
      session = (createCapricornRuntime as CapricornRuntimeFactory)(container, {
        markdown: '[Website](https://example.com)',
        mode: 'edit',
        linkOpenMode: 'button',
        handleLinkClick,
      })
    })
    const link = container.querySelector<HTMLAnchorElement>('a[href="https://example.com"]')!
    expect(link).not.toBeNull()
    await act(async () => link.click())
    expect(handleLinkClick).not.toHaveBeenCalled()
    await act(async () => {
      link.dispatchEvent(new MouseEvent('pointerover', { bubbles: true }))
    })
    const actions = within(document.body).getByRole('group', { name: 'Link actions' })
    await act(async () => within(actions).getByRole('button', { name: 'Open link' }).click())
    expect(handleLinkClick).toHaveBeenCalledExactlyOnceWith('https://example.com')
    expect(session!.getMarkdown()).toBe('[Website](https://example.com)')
  })
})
