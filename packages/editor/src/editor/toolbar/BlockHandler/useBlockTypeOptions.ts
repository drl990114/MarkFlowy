import type { ProsemirrorNode } from '@rme-sdk/core'
import { TextSelection } from '@rme-sdk/pm/state'
import { useCommands } from '@rme-sdk/react-core'
import { useMemo } from 'react'
import { useTranslation } from '@markflowy/i18n'
import { LineListExtension } from '../../extensions'
import type { ListAttributes } from '../../extensions/List/input-rule/types'
import { nodeTypeIconMap } from '../../const'
import type { BlockTypeGroup, BlockTypeOption, NodeTransformContext } from './types'

const isHeading = (level: number) => (node: ProsemirrorNode) =>
  node.type.name === 'heading' && node.attrs.level === level

const isParagraph = (node: ProsemirrorNode) => node.type.name === 'paragraph'

const isCodeBlock = (node: ProsemirrorNode) => node.type.name === 'codeMirror'

const isBlockquote = (node: ProsemirrorNode) => node.type.name === 'blockquote'

const isList = (kind: string) => (node: ProsemirrorNode) =>
  node.type.name === 'list' && node.attrs.kind === kind

const canSetTextBlockType = (node: ProsemirrorNode) => {
  return ['paragraph', 'heading', 'codeMirror'].includes(node.type.name)
}

const canTransformToTextBlock = (node: ProsemirrorNode) => {
  return canSetTextBlockType(node)
}

const canTransformToList = (node: ProsemirrorNode) => {
  return ['paragraph', 'heading', 'list'].includes(node.type.name)
}

const canTransformToCodeBlock = (node: ProsemirrorNode) => {
  return ['paragraph', 'heading'].includes(node.type.name)
}

const canTransformToBlockquote = (node: ProsemirrorNode) => {
  return ['paragraph', 'heading'].includes(node.type.name)
}

const selectInsideNode = ({ view, pos }: NodeTransformContext) => {
  const docSize = view.state.doc.content.size
  const textPos = Math.max(0, Math.min(pos + 1, docSize))
  const selection = TextSelection.near(view.state.doc.resolve(textPos), 1)
  view.dispatch(view.state.tr.setSelection(selection).setMeta('addToHistory', false))
  view.focus()
}

const setSelectionInsideTransformedNode = (
  tr: NodeTransformContext['tr'],
  pos: number,
) => {
  const textPos = Math.max(0, Math.min(pos + 1, tr.doc.content.size))
  tr.setSelection(TextSelection.near(tr.doc.resolve(textPos), 1))
}

const deleteNode = (context: NodeTransformContext) => {
  const { view, pos, node, tr } = context

  tr.delete(pos, pos + node.nodeSize)

  const newPos = Math.max(0, Math.min(pos, tr.doc.content.size))
  tr.setSelection(TextSelection.create(tr.doc, newPos))

  view.dispatch(tr)
  view.focus()

  return true
}

const transformToHeading = (level: number) => (context: NodeTransformContext) => {
  const { view, pos, tr } = context
  const headingType = view.state.schema.nodes.heading
  if (!headingType) return false

  tr.setBlockType(pos, pos + context.node.nodeSize, headingType, { level })
  setSelectionInsideTransformedNode(tr, pos)
  view.dispatch(tr)
  view.focus()
  return true
}

const transformToParagraph = (context: NodeTransformContext) => {
  const { view, pos, tr } = context
  const paragraphType = view.state.schema.nodes.paragraph
  if (!paragraphType) return false

  tr.setBlockType(pos, pos + context.node.nodeSize, paragraphType)
  setSelectionInsideTransformedNode(tr, pos)
  view.dispatch(tr)
  view.focus()
  return true
}

const transformToCodeBlock = (context: NodeTransformContext) => {
  const { view, pos, node, tr } = context
  const codeMirrorType = view.state.schema.nodes.codeMirror
  if (!codeMirrorType) return false

  tr.setBlockType(pos, pos + node.nodeSize, codeMirrorType, { language: '' })
  setSelectionInsideTransformedNode(tr, pos)

  view.dispatch(tr)
  view.focus()
  return true
}

const transformToBlockquote = (context: NodeTransformContext) => {
  const { view, pos, node, tr } = context
  const blockquoteType = view.state.schema.nodes.blockquote
  const paragraphType = view.state.schema.nodes.paragraph
  if (!blockquoteType || !paragraphType) return false

  const content = node.content
  const paragraph = paragraphType.create(null, content)
  const blockquote = blockquoteType.create(null, paragraph)

  tr.delete(pos, pos + node.nodeSize)
  tr.insert(pos, blockquote)

  setSelectionInsideTransformedNode(tr, pos)

  view.dispatch(tr)
  view.focus()
  return true
}

export const useBlockTypeOptions = (
  t: (key: string, options?: any) => string,
  commands: ReturnType<typeof useCommands<LineListExtension>>,
): BlockTypeOption[] => {
  const options = useMemo<BlockTypeOption[]>(() => {
    const transformToList = (attrs: ListAttributes) => (context: NodeTransformContext) => {
      if (!commands.toggleList) return false

      selectInsideNode(context)
      commands.toggleList(attrs)
      context.view.focus()
      return true
    }

    const headingOptions: BlockTypeOption[] = Array.from({ length: 6 }, (_, i) => {
      const level = i + 1
      return {
        key: `heading-${level}`,
        label: t('blockType.heading', { level }) || `Heading ${level}`,
        icon: nodeTypeIconMap[`heading-${level}`] || 'ri-heading',
        group: 'transform' as const,
        isActive: isHeading(level),
        isAvailable: canTransformToTextBlock,
        transform: transformToHeading(level),
      }
    })

    const baseOptions: BlockTypeOption[] = [
      {
        key: 'paragraph',
        label: t('blockType.paragraph') || 'Paragraph',
        icon: nodeTypeIconMap.paragraph,
        group: 'transform' as const,
        isActive: isParagraph,
        isAvailable: canTransformToTextBlock,
        transform: transformToParagraph,
      },
      ...headingOptions,
      {
        key: 'code-block',
        label: t('blockType.codeBlock') || 'Code Block',
        icon: nodeTypeIconMap.codeMirror,
        group: 'transform' as const,
        isActive: isCodeBlock,
        isAvailable: canTransformToCodeBlock,
        transform: transformToCodeBlock,
      },
      {
        key: 'blockquote',
        label: t('blockType.blockquote') || 'Quote',
        icon: nodeTypeIconMap.blockquote,
        group: 'transform' as const,
        isActive: isBlockquote,
        isAvailable: canTransformToBlockquote,
        transform: transformToBlockquote,
      },
      {
        key: 'bullet-list',
        label: t('blockType.bulletList') || 'Bullet List',
        icon: nodeTypeIconMap['list-bullet'],
        group: 'transform' as const,
        isActive: isList('bullet'),
        isAvailable: canTransformToList,
        transform: transformToList({}),
      },
      {
        key: 'ordered-list',
        label: t('blockType.orderedList') || 'Ordered List',
        icon: nodeTypeIconMap['list-ordered'],
        group: 'transform' as const,
        isActive: isList('ordered'),
        isAvailable: canTransformToList,
        transform: transformToList({ kind: 'ordered' }),
      },
      {
        key: 'task-list',
        label: t('blockType.taskList') || 'Task List',
        icon: nodeTypeIconMap['list-task'],
        group: 'transform' as const,
        isActive: isList('task'),
        isAvailable: canTransformToList,
        transform: transformToList({ kind: 'task' }),
      },
    ]

    const actionOptions: BlockTypeOption[] = [
      {
        key: 'delete',
        label: t('blockType.delete') || 'Delete',
        icon: 'ri-delete-bin-line',
        group: 'actions' as const,
        action: deleteNode,
      },
    ]

    return [...baseOptions, ...actionOptions]
  }, [t, commands])

  return options
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
        children: [
          otherOptions.find((opt) => opt.key === 'paragraph')!,
          ...headingOptions,
        ].filter(Boolean),
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
    ]
  }, [options, t])
}
