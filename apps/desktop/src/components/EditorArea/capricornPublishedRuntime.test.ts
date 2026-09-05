import { act, fireEvent, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { isCapricornRuntimeAvailable } from '@/constants/editorViewType'
import { createCapricornRuntime } from 'virtual:markflowy-capricorn-runtime'
import zhCNLocale from '../../../../../locales/zh-CN.json'

import {
  CAPRICORN_DESKTOP_VIRTUALIZE_OPTIONS,
  createCapricornRuntimeAdapter,
  type CapricornInlineEditRequest,
  type CapricornRuntimeFactory,
  type CapricornRuntimeSession,
} from './capricornRuntimeAdapter'

let session: CapricornRuntimeSession | undefined

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
      bufferRange: 900,
      enable: true,
      enableScrollAnchoring: true,
      firstPaintBlockSize: 40,
    })

    session = (createCapricornRuntime as CapricornRuntimeFactory)(container, {
      markdown: '# Capricorn',
      mode: 'edit',
      virtualize: CAPRICORN_DESKTOP_VIRTUALIZE_OPTIONS,
    })

    expect(session.getMarkdown()).toBe('# Capricorn')
    expect(container.childElementCount).toBeGreaterThan(0)
  })

  it('applies and updates typography on the content root without changing the document or undo history', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const original = 'Body with `inline code`\n\n```js\nconst value = 1\n```'
    const initialStyle = {
      fontFamily: 'serif',
      fontSize: 18,
      lineHeight: '1.8',
      '--cap-font-mono': 'monospace',
      '--cap-code-font-family': 'monospace',
    }
    await act(async () => {
      session = (createCapricornRuntime as CapricornRuntimeFactory)(container, {
        markdown: original,
        mode: 'edit',
        style: initialStyle,
      })
    })
    const content = container.querySelector<HTMLElement>('[data-cap-content]')!
    expect(content).not.toBeNull()
    expect(content.style.fontFamily).toBe('serif')
    expect(content.style.fontSize).toBe('18px')
    expect(content.style.lineHeight).toBe('1.8')
    expect(content.style.getPropertyValue('--cap-font-mono')).toBe('monospace')
    await act(async () =>
      session!.commands.insertLink!({ href: 'https://example.com', text: 'Link' }),
    )
    const markdown = session!.getMarkdown()
    expect(markdown).not.toBe(original)
    const history = session!.getUiState()
    expect(history.canUndo).toBe(true)
    const updatedStyle = {
      fontFamily: '"LXGW WenKai"',
      fontSize: 24,
      lineHeight: '2',
      '--cap-font-mono': '"JetBrains Mono"',
      '--cap-code-font-family': '"JetBrains Mono"',
      '--cap-code-font-size': '21px',
    }
    await act(async () => session!.updateSettings({ style: updatedStyle }))
    expect(container.querySelector('[data-cap-content]')).toBe(content)
    expect(content.style.fontFamily).toBe('"LXGW WenKai"')
    expect(content.style.fontSize).toBe('24px')
    expect(content.style.lineHeight).toBe('2')
    expect(content.style.getPropertyValue('--cap-font-mono')).toBe('"JetBrains Mono"')
    expect(content.style.getPropertyValue('--cap-code-font-family')).toBe('"JetBrains Mono"')
    expect(content.style.getPropertyValue('--cap-code-font-size')).toBe('21px')
    expect(session!.getMarkdown()).toBe(markdown)
    expect(session!.getUiState()).toMatchObject({
      canUndo: history.canUndo,
      canRedo: history.canRedo,
    })
    await act(async () => session!.commands.undo())
    expect(session!.getMarkdown()).toBe(original)
    await act(async () => session!.commands.redo())
    expect(session!.getMarkdown()).toBe(markdown)
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
    const buttons = within(actions).getAllByRole('button')
    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Edit link',
      'Open link',
    ])
    expect(buttons.every((button) => button.textContent === '')).toBe(true)
    await act(async () => buttons[1].click())
    expect(handleLinkClick).toHaveBeenCalledExactlyOnceWith('https://example.com')
    expect(session!.getMarkdown()).toBe('[Website](https://example.com)')
  })

  it.each([
    ['https://example.com', 'https://example.com'],
    ['../%E5%85%B3%E4%BA%8E%23%2520.md', '../关于%23%2520.md'],
  ])(
    'edits the localized hover link %s while preserving snapshots and undo',
    async (href, displayed) => {
      const container = document.createElement('div')
      document.body.append(container)
      const original = `[Website](${href})`
      const labels = Object.fromEntries(
        Object.entries(zhCNLocale.capricorn.link).map(([key, value]) => [`link.${key}`, value]),
      )
      const handleLinkClick = vi.fn()
      const onChange = vi.fn()
      const onEdit = vi.fn<(request: CapricornInlineEditRequest | null) => void>()
      let adapter!: ReturnType<typeof createCapricornRuntimeAdapter>
      await act(async () => {
        adapter = createCapricornRuntimeAdapter({
          container,
          createRuntime: createCapricornRuntime as CapricornRuntimeFactory,
          onChange,
          options: {
            markdown: original,
            mode: 'edit',
            handleLinkClick,
            localization: {
              getLocale: () => 'zh-CN',
              translate: ({ key, defaultValue }) => labels[key] ?? defaultValue,
            },
          },
        })
      })
      const unsubscribe = adapter.subscribeInlineEdit!(onEdit)
      try {
        const link = container.querySelector<HTMLAnchorElement>('a[href]')!
        await act(async () => fireEvent.pointerOver(link))
        const actions = within(document.body).getByRole('group', { name: '链接操作' })
        await act(async () => within(actions).getByRole('button', { name: '编辑链接' }).click())
        const dialog = within(document.body).getByRole('dialog', { name: '编辑链接' })
        const text = within(dialog).getByRole('textbox', { name: '文字' })
        const address = within(dialog).getByRole('textbox', { name: '地址' })
        expect((address as HTMLInputElement).value).toBe(displayed)
        await act(async () => {
          fireEvent.change(text, { target: { value: 'MarkFlowy' } })
          fireEvent.change(address, { target: { value: 'https://markflowy.com' } })
        })
        await act(async () => within(dialog).getByRole('button', { name: '保存链接' }).click())
        expect(adapter.getMarkdown()).toBe('[MarkFlowy](https://markflowy.com)')
        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ documentChanged: true }))
        expect(onEdit).not.toHaveBeenCalled()
        expect(handleLinkClick).not.toHaveBeenCalled()
        expect(within(document.body).queryByRole('dialog', { name: '编辑链接' })).toBeNull()
        await act(async () => adapter.commands.undo())
        expect(adapter.getMarkdown()).toBe(original)
        await act(async () => adapter.commands.redo())
        expect(adapter.getMarkdown()).toBe('[MarkFlowy](https://markflowy.com)')
      } finally {
        unsubscribe()
        act(() => adapter.destroy())
      }
    },
  )

  it('renders and preserves an embedded Base64 image from the installed package', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const source =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8L8AAAAASUVORK5CYII='
    const markdown = `![内嵌图片](${source})`
    await act(async () => {
      session = (createCapricornRuntime as CapricornRuntimeFactory)(container, { markdown })
    })
    expect(container.querySelector('img')?.getAttribute('src')).toBe(source)
    expect(session!.getMarkdown()).toBe(markdown)
  })
})
