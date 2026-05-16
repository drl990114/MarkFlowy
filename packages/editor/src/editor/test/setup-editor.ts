import '@rme-sdk/pm'
import '@rme-sdk/preset-core'
import 'jest-prosemirror'

import { BlockquoteExtension } from '@rme-sdk/extension-blockquote'
import { HeadingExtension } from '@rme-sdk/extension-heading'
import { HorizontalRuleExtension } from '@rme-sdk/extension-horizontal-rule'
import { renderEditor, type TaggedProsemirrorNode } from 'jest-remirror'
import type { Command } from 'prosemirror-state'
import { expect } from 'vitest'


import { ListAttributes } from '../extensions/List/input-rule/types'
import { ListExtension } from './extension'
import { markdownToTaggedDoc } from './markdown'

export function setupTestingEditor() {
  const extensions = [
    new ListExtension(),
    new BlockquoteExtension(),
    new HorizontalRuleExtension({}),
    new HeadingExtension({}),
  ]
  const editor = renderEditor(extensions, {})
  const {
    view,
    add,
    nodes: { doc, p, blockquote, horizontalRule },
    attributeNodes: { list: untypedList },
    manager,
    schema,
  } = editor

  const markdown = (
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): TaggedProsemirrorNode => {
    const markdown = String.raw({ raw: strings }, ...values)
    return markdownToTaggedDoc(editor, markdown)
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

  const list = (attributes: ListAttributes) => {
    return untypedList(attributes as Record<string, unknown>)
  }

  const bulletList = list({ kind: 'bullet' })
  const orderedList = list({ kind: 'ordered' })
  const ordered99List = list({ kind: 'ordered', order: 99 })
  const checkedTaskList = list({ kind: 'task', checked: true })
  const uncheckedTaskList = list({ kind: 'task', checked: false })
  const collapsedToggleList = list({ kind: 'toggle', collapsed: true })
  const expandedToggleList = list({ kind: 'toggle', collapsed: false })

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
    blockquote,
    horizontalRule,

    bulletList,
    orderedList,
    checkedTaskList,
    uncheckedTaskList,
    collapsedToggleList,
    expandedToggleList,
    ordered99List,
  }
}

export type TestingEditor = ReturnType<
  ReturnType<typeof setupTestingEditor>['add']
>
