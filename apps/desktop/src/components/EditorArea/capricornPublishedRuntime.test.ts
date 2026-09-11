import { act, within } from '@testing-library/react'
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
