import { renderEditor } from 'jest-remirror'
import { describe, expect, it, vi } from 'vitest'
import type { Node as ProsemirrorNode } from '@rme-sdk/pm/model'
import type { ImageInsertAttributes } from '..'
import { MdImgUriExtension } from './md-image-extension'

describe('MdImgUriExtension image insertion', () => {
  it('inserts image attributes through the direct command', () => {
    const editor = renderEditor([new MdImgUriExtension()])
    const {
      add,
      commands,
      nodes: { doc, p },
    } = editor

    add(doc(p('before<cursor>')))
    expect(
      commands.insertMarkdownImage({
        src: '/photos/local.png',
        alt: 'local',
        'data-file-name': 'local.png',
      }),
    ).toBe(true)

    let image: ProsemirrorNode | undefined
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'md_image') image = node
    })
    expect(image?.attrs.src).toBe('/photos/local.png')
  })

  it('inserts a locally selected image after the async picker resolves', async () => {
    let resolveSelection: ((attributes: ImageInsertAttributes) => void) | undefined
    const editor = renderEditor([
      new MdImgUriExtension({
        imageInsertHandler: () =>
          new Promise((resolve) => {
            resolveSelection = resolve
          }),
      }),
    ])
    const {
      add,
      commands,
      nodes: { doc, p },
    } = editor

    add(doc(p('before<cursor>')))
    expect(commands.requestImageInsert()).toBe(true)

    resolveSelection?.({
      src: '/photos/local.png',
      alt: 'local',
      'data-file-name': 'local.png',
    })
    await vi.waitFor(() => {
      let image: ProsemirrorNode | undefined
      editor.state.doc.descendants((node) => {
        if (node.type.name === 'md_image') image = node
      })
      expect(image?.type.name).toBe('md_image')
      expect(image?.attrs).toMatchObject({
        src: '/photos/local.png',
        alt: 'local',
        'data-file-name': 'local.png',
      })
    })
  })
})
