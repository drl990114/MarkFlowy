import { useTranslation } from '@markflowy/i18n'
import type { ProsemirrorNode } from '@rme-sdk/sdk/core'
import type { StandardListKind } from '@rme-sdk/sdk/extensions/list'
import { setBlockType, wrapIn } from '@rme-sdk/sdk/pm/commands'
import { liftListItem } from '@rme-sdk/sdk/pm/schema-list'
import { NodeSelection, TextSelection } from '@rme-sdk/sdk/pm/state'
import { useCommands } from '@rme-sdk/sdk/react'
import { useMemo } from 'react'

import { nodeTypeIconMap } from '../../const'
import type { BlockTypeGroup, BlockTypeOption, NodeTransformContext } from './types'

type EditorCommands = ReturnType<typeof useCommands>

function getContentBlock(context: NodeTransformContext): ProsemirrorNode | null {
  if (context.node.type.name !== 'listItem') return context.node
  return context.node.childCount === 1 ? context.node.firstChild : null
}

const isHeading = (level: number) => (context: NodeTransformContext) => {
  const node = getContentBlock(context)
  return node?.type.name === 'heading' && node.attrs.level === level
}

const isNodeType = (type: string) => (context: NodeTransformContext) => {
  return getContentBlock(context)?.type.name === type
}

function getListKind(context: NodeTransformContext): StandardListKind | null {
  if (context.node.type.name !== 'listItem') return null
  if (context.node.attrs.checked !== null) return 'task'

  const parent = context.view.state.doc.resolve(context.pos).parent
  return parent.type.name === 'orderedList' ? 'ordered' : 'bullet'
}

const isList = (kind: StandardListKind) => (context: NodeTransformContext) => {
  return getListKind(context) === kind
}

function canSetTextBlockType(context: NodeTransformContext): boolean {
  const node = getContentBlock(context)
  return !!node && ['paragraph', 'heading', 'codeMirror'].includes(node.type.name)
}

function canTransformToList(context: NodeTransformContext): boolean {
  const node = getContentBlock(context)
  return (
    context.node.type.name === 'listItem' ||
    (!!node && ['paragraph', 'heading'].includes(node.type.name))
  )
}

function canTransformToCodeBlock(context: NodeTransformContext): boolean {
  const node = getContentBlock(context)
  return !!node && ['paragraph', 'heading'].includes(node.type.name)
}

function canTransformToBlockquote(context: NodeTransformContext): boolean {
  const node = getContentBlock(context)
  return !!node && ['paragraph', 'heading'].includes(node.type.name)
}

function selectInsideNode({ view, pos }: NodeTransformContext): void {
  const docSize = view.state.doc.content.size
  const textPos = Math.max(0, Math.min(pos + 1, docSize))
  const selection = TextSelection.near(view.state.doc.resolve(textPos), 1)
  view.dispatch(view.state.tr.setSelection(selection).setMeta('addToHistory', false))
  view.focus()
}

function liftSelectedListItem(context: NodeTransformContext): boolean {
  if (context.node.type.name !== 'listItem') return true

  const { view } = context
  const listItemType = view.state.schema.nodes.listItem
  return !!listItemType && liftListItem(listItemType)(view.state, view.dispatch, view)
}

function prepareTextBlock(context: NodeTransformContext): boolean {
  selectInsideNode(context)
  return liftSelectedListItem(context)
}

function deleteNode(context: NodeTransformContext): boolean {
  const { view, pos, tr } = context
  const selection = NodeSelection.create(tr.doc, pos)
  selection.replace(tr)

  const nextPos = Math.max(0, Math.min(tr.mapping.map(pos), tr.doc.content.size))
  tr.setSelection(TextSelection.near(tr.doc.resolve(nextPos), -1))
  view.dispatch(tr)
  view.focus()
  return true
}

function transformToTextBlock(
  context: NodeTransformContext,
  typeName: 'paragraph' | 'heading' | 'codeMirror',
  attrs?: Record<string, unknown>,
): boolean {
  if (!prepareTextBlock(context)) return false

  const { view } = context
  const type = view.state.schema.nodes[typeName]
  if (!type) return false

  const transformed = setBlockType(type, attrs)(view.state, view.dispatch, view)
  if (transformed) view.focus()
  return transformed
}

function transformToBlockquote(context: NodeTransformContext): boolean {
  if (!prepareTextBlock(context)) return false

  const { view } = context
  const paragraphType = view.state.schema.nodes.paragraph
  const blockquoteType = view.state.schema.nodes.blockquote
  if (!paragraphType || !blockquoteType) return false

  setBlockType(paragraphType)(view.state, view.dispatch, view)
  const transformed = wrapIn(blockquoteType)(view.state, view.dispatch, view)
  if (transformed) view.focus()
  return transformed
}

function runListCommand(
  kind: StandardListKind,
  commands: EditorCommands,
  context: NodeTransformContext,
): boolean {
  selectInsideNode(context)
  const command =
    kind === 'ordered'
      ? commands.toggleOrderedList
      : kind === 'task'
        ? commands.toggleTaskList
        : commands.toggleBulletList

  if (!command?.enabled()) return false
  command()
  context.view.focus()
  return true
}

export const useBlockTypeOptions = (
  t: (key: string, options?: any) => string,
  commands: EditorCommands,
): BlockTypeOption[] => {
  return useMemo<BlockTypeOption[]>(() => {
    const headingOptions: BlockTypeOption[] = Array.from({ length: 6 }, (_, i) => {
      const level = i + 1
      return {
        key: `heading-${level}`,
        label: t('blockType.heading', { level }) || `Heading ${level}`,
        icon: nodeTypeIconMap[`heading-${level}`] || 'ri-heading',
        group: 'transform' as const,
        isActive: isHeading(level),
        isAvailable: canSetTextBlockType,
        transform: (context) => transformToTextBlock(context, 'heading', { level }),
      }
    })

    const baseOptions: BlockTypeOption[] = [
      {
        key: 'paragraph',
        label: t('blockType.paragraph') || 'Paragraph',
        icon: nodeTypeIconMap.paragraph,
        group: 'transform',
        isActive: isNodeType('paragraph'),
        isAvailable: canSetTextBlockType,
        transform: (context) => transformToTextBlock(context, 'paragraph'),
      },
      ...headingOptions,
      {
        key: 'code-block',
        label: t('blockType.codeBlock') || 'Code Block',
        icon: nodeTypeIconMap.codeMirror,
        group: 'transform',
        isActive: isNodeType('codeMirror'),
        isAvailable: canTransformToCodeBlock,
        transform: (context) => transformToTextBlock(context, 'codeMirror', { language: '' }),
      },
      {
        key: 'blockquote',
        label: t('blockType.blockquote') || 'Quote',
        icon: nodeTypeIconMap.blockquote,
        group: 'transform',
        isActive: isNodeType('blockquote'),
        isAvailable: canTransformToBlockquote,
        transform: transformToBlockquote,
      },
      ...(['bullet', 'ordered', 'task'] as const).map(
        (kind): BlockTypeOption => ({
          key: `${kind}-list`,
          label:
            kind === 'bullet'
              ? t('blockType.bulletList') || 'Bullet List'
              : kind === 'ordered'
                ? t('blockType.orderedList') || 'Ordered List'
                : t('blockType.taskList') || 'Task List',
          icon: nodeTypeIconMap[`list-${kind}`],
          group: 'transform',
          isActive: isList(kind),
          isAvailable: canTransformToList,
          transform: (context) => runListCommand(kind, commands, context),
        }),
      ),
    ]

    return [
      ...baseOptions,
      {
        key: 'delete',
        label: t('blockType.delete') || 'Delete',
        icon: 'ri-delete-bin-line',
        group: 'actions',
        action: deleteNode,
      },
    ]
  }, [t, commands])
}

export const useBlockTypeGroups = (): BlockTypeGroup[] => {
  const { t } = useTranslation()
  const commands = useCommands()
  const options = useBlockTypeOptions(t, commands)

  return useMemo(() => {
    const headingOptions = options.filter((opt) => opt.key.startsWith('heading'))
    const otherOptions = options.filter((opt) => !opt.key.startsWith('heading'))

    return [
      {
        key: 'text',
        label: t('blockTypeGroup.text') || 'Text',
        children: [otherOptions.find((opt) => opt.key === 'paragraph')!, ...headingOptions].filter(
          Boolean,
        ),
      },
      {
        key: 'list',
        label: t('blockTypeGroup.list') || 'List',
        children: [
          otherOptions.find((opt) => opt.key === 'bullet-list')!,
          otherOptions.find((opt) => opt.key === 'ordered-list')!,
          otherOptions.find((opt) => opt.key === 'task-list')!,
        ].filter(Boolean),
      },
      {
        key: 'other',
        label: t('blockTypeGroup.other') || 'Other',
        children: [
          otherOptions.find((opt) => opt.key === 'code-block')!,
          otherOptions.find((opt) => opt.key === 'blockquote')!,
        ].filter(Boolean),
      },
      {
        key: 'actions',
        label: '',
        children: options.filter((opt) => opt.group === 'actions'),
      },
    ]
  }, [options, t])
}
