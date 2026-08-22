import '@rme-sdk/sdk/pm'
import '@rme-sdk/sdk/presets/core'
import 'jest-prosemirror'

import { renderEditor, type TaggedProsemirrorNode } from 'jest-remirror'
import type { Command } from 'prosemirror-state'
import { expect } from 'vitest'

import { ListExtension } from './extension'
import { markdownToTaggedDoc } from './markdown'

export function setupTestingEditor() {
  const extensions = [new ListExtension()]
  // jest-remirror bundles Remirror's nominal extension type separately from RME.
  // Runtime compatibility is covered by the Markdown tests using this helper.
  const editor = renderEditor(extensions as unknown as Parameters<typeof renderEditor>[0], {})
  const {
    view,
    add,
    nodes: { doc, p },
    attributeNodes: {
      bulletList: untypedBulletList,
      orderedList: untypedOrderedList,
      listItem: untypedListItem,
    },
    manager,
    schema,
  } = editor

  const markdown = (strings: TemplateStringsArray, ...values: unknown[]): TaggedProsemirrorNode => {
    const source = String.raw({ raw: strings }, ...values)
    return markdownToTaggedDoc(editor, source)
  }

  const dispatchCommand = (command: Command) => {
    return command(view.state, view.dispatch.bind(view), view)
  }

  const applyCommand = (
    command: Command,
    before: TaggedProsemirrorNode,
    after: TaggedProsemirrorNode | null,
  ) => {
    add(before)
    const result = dispatchCommand(command)
    if (!after) {
      expect(result).toBe(false)
    } else {
      expect(editor.state).toEqualRemirrorState(after)
    }
  }

  const bulletList = untypedBulletList({ tight: true })
  const orderedList = untypedOrderedList({ order: 1, tight: true })
  const ordered99List = untypedOrderedList({ order: 99, tight: true })
  const listItem = untypedListItem({ checked: null })
  const checkedTaskItem = untypedListItem({ checked: true })
  const uncheckedTaskItem = untypedListItem({ checked: false })

  return {
    manager,
    view,
    schema,
    add,
    markdown,
    dispatchCommand,
    applyCommand,
    editor,

    doc,
    p,

    bulletList,
    orderedList,
    listItem,
    checkedTaskItem,
    uncheckedTaskItem,
    ordered99List,
  }
}

export type TestingEditor = ReturnType<ReturnType<typeof setupTestingEditor>['add']>
