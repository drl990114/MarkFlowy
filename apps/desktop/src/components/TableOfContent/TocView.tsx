import { Toc } from '@/components/TableOfContent'
import { getHeadingValue } from '@/helper/string'
import { useCommandStore, useEditorStore } from '@/stores'
import useEditorViewTypeStore from '@/stores/useEditorViewTypeStore'
import { t } from 'i18next'
import type { Node as ProseMirrorNode } from 'prosemirror-model'
import { TextSelection } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'
import { useCallback, useEffect, useRef, useState } from 'react'
import { EditorViewType, extractMatches } from 'rme'
import type { TocRef } from 'zens'
import { IHeadingData } from 'zens/lib/TableOfContent/HeadingTree'
import { sourceCodeCodemirrorViewMap } from '../EditorArea/TextEditor'
import SideBarHeader from '../SideBar/SideBarHeader'
import { TocViewContainer } from './styles'

type HeadingInfo = {
  node: ProseMirrorNode
  pos: number
  level: number
  text: string
  id: string
}

type SourceHeadingInfo = {
  pos: number
  depth: number
  value: string
  id: string
}

const getAllHeadings = (doc: ProseMirrorNode): HeadingInfo[] => {
  const headings: HeadingInfo[] = []

  doc.descendants((node, pos) => {
    if (node.type.name === 'heading') {
      headings.push({
        node,
        pos, // 节点在文档中的位置
        level: node.attrs.level as number, // heading 级别 (1-6)
        text: node.textContent, // 标题文本内容
        id: `heading-${pos}`,
      })
      // 返回 false 表示不进入该节点的子节点（heading 通常没有子节点需要遍历）
      return false
    }
  })

  return headings
}

const jumpToHeading = (
  editorView: EditorView,
  headingPos: number,
  scrollEl?: HTMLElement | null,
) => {
  const { state, dispatch } = editorView

  const tr = state.tr
  const selection = TextSelection.create(tr.doc, headingPos + 1)
  tr.setSelection(selection)

  dispatch(tr.scrollIntoView())

  editorView.focus()

  const { from } = editorView.state.selection
  const coords = editorView.coordsAtPos(from)

  if (scrollEl) {
    const containerTop = scrollEl.getBoundingClientRect().top
    const targetTop = coords.top - containerTop + scrollEl.scrollTop - 100
    scrollEl.scrollTo({
      top: targetTop,
      behavior: 'smooth',
    })
    return
  }

  window.scrollTo({
    top: coords.top - 100, // 偏移 100px，避免被固定导航遮挡
    behavior: 'smooth',
  })
}

const resolveActiveHeadingId = (params: {
  headings: Array<{ pos: number; id: string }>
  scrollEl: HTMLElement | null
  getCoords: (pos: number) => { top: number } | null
  offset?: number
}): string | null => {
  const { headings, scrollEl, getCoords, offset = 120 } = params
  if (!scrollEl || headings.length === 0) {
    return null
  }

  const containerTop = scrollEl.getBoundingClientRect().top
  const activeLine = containerTop + offset
  let currentId: string | null = headings[0]?.id ?? null

  for (const heading of headings) {
    try {
      const coords = getCoords(heading.pos)
      if (!coords) {
        continue
      }

      if (coords.top <= activeLine) {
        currentId = heading.id
      } else {
        break
      }
    } catch (error) {
      continue
    }
  }

  return currentId
}

type TocViewProps = {
  variant?: 'sidebar' | 'editor'
}

export const TocView = ({ variant = 'sidebar' }: TocViewProps) => {
  const tocRef = useRef<TocRef>(null)
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null)
  const wysiwygHeadingsRef = useRef<HeadingInfo[]>([])
  const sourceHeadingsRef = useRef<SourceHeadingInfo[]>([])
  const wysiwygScrollElRef = useRef<HTMLElement | null>(null)
  const [sourceScrollEl, setSourceScrollEl] = useState<HTMLElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const scheduleActiveHeadingUpdateRef = useRef<() => void>(() => {})

  const calculateActiveHeadingId = useCallback(() => {
    const activeId = useEditorStore.getState().activeId
    if (!activeId) return null

    const editorViewTypeMap = useEditorViewTypeStore.getState().editorViewTypeMap
    const viewType = editorViewTypeMap.get(activeId)

    if (viewType === EditorViewType.WYSIWYG) {
      const editorDelegate = useEditorStore.getState().getEditorDelegate(activeId)
      const editorView = editorDelegate?.manager?.view
      if (!editorView) {
        return null
      }

      return resolveActiveHeadingId({
        headings: wysiwygHeadingsRef.current,
        scrollEl: wysiwygScrollElRef.current,
        getCoords: (pos) => editorView.coordsAtPos(pos),
      })
    }

    if (viewType === EditorViewType.SOURCECODE) {
      const codemirrorView = sourceCodeCodemirrorViewMap.get(activeId)
      if (!codemirrorView) {
        return null
      }

      return resolveActiveHeadingId({
        headings: sourceHeadingsRef.current,
        scrollEl: sourceScrollEl,
        getCoords: (pos) => codemirrorView.cm.coordsAtPos(pos),
      })
    }

    return null
  }, [sourceScrollEl])

  const scheduleActiveHeadingUpdate = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
    }

    rafRef.current = requestAnimationFrame(() => {
      const nextActiveId = calculateActiveHeadingId()
      setActiveHeadingId(nextActiveId)
    })
  }, [calculateActiveHeadingId])

  useEffect(() => {
    scheduleActiveHeadingUpdateRef.current = scheduleActiveHeadingUpdate
  }, [scheduleActiveHeadingUpdate])

  useEffect(() => {
    const addCommand = useCommandStore.getState().addCommand
    addCommand({
      id: 'app:toc_refresh',
      handler: () => {
        const activeId = useEditorStore.getState().activeId
        const editorViewTypeMap = useEditorViewTypeStore.getState().editorViewTypeMap

        if (!activeId) return

        if (editorViewTypeMap.get(activeId) === EditorViewType.SOURCECODE) {
          const codemirrorView = sourceCodeCodemirrorViewMap.get(activeId)
          if (!codemirrorView) {
            return
          }

          setTimeout(() => {
            const matches = extractMatches(codemirrorView.cm)
            const sourceHeadings: SourceHeadingInfo[] = matches.map((match) => {
              const depth = Number(match.type.split('ATXHeading')?.[1]) || 1
              const value = getHeadingValue(match.value)
              const pos = match.to

              return {
                depth,
                value,
                pos,
                id: `heading-${pos}`,
              }
            })

            sourceHeadingsRef.current = sourceHeadings
            setSourceScrollEl(codemirrorView.cm.scrollDOM)

            const headings: IHeadingData[] = sourceHeadings.map((heading) => {
              return {
                depth: heading.depth,
                value: heading.value,
                id: heading.id,
                htmlNode: null,
                onClick: () => {
                  codemirrorView.cm.dispatch({
                    selection: {
                      anchor: heading.pos,
                      head: heading.pos,
                    },
                    scrollIntoView: true,
                  })
                  codemirrorView.cm.focus()
                },
              }
            })
            tocRef.current?.refreshByHeadings({ newHeadings: headings })
            scheduleActiveHeadingUpdateRef.current()
          }, 0)
          return
        }

        if (editorViewTypeMap.get(activeId) === EditorViewType.WYSIWYG) {
          const editorDelegate = useEditorStore.getState().getEditorDelegate(activeId)
          const editorView = editorDelegate?.manager?.view
          if (!editorView) {
            return
          }

          setTimeout(() => {
            const headingInfos = getAllHeadings(editorView.state.doc)
            wysiwygHeadingsRef.current = headingInfos

            const headings = headingInfos.map((heading) => {
              return {
                depth: heading.level,
                value: heading.text,
                id: heading.id,
                htmlNode: null,
                onClick: () => jumpToHeading(editorView, heading.pos, wysiwygScrollElRef.current),
              } as IHeadingData
            })

            tocRef.current?.refreshByHeadings({ newHeadings: headings })
            scheduleActiveHeadingUpdateRef.current()
          }, 0)
          return
        }

        setTimeout(() => {
          tocRef.current?.refresh({
            newContainer: document.querySelector('#editor-panel') as HTMLElement,
            newScroll: document.querySelector('#editor-panel') as HTMLElement,
          })
        }, 0)
      },
    })
  }, [])

  useEffect(() => {
    const scrollEl = document.querySelector('#editor-panel') as HTMLElement | null
    if (!scrollEl) return

    wysiwygScrollElRef.current = scrollEl

    const handleScroll = () => scheduleActiveHeadingUpdate()
    scrollEl.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()

    return () => {
      scrollEl.removeEventListener('scroll', handleScroll)
    }
  }, [scheduleActiveHeadingUpdate])

  useEffect(() => {
    if (!sourceScrollEl) return

    const handleScroll = () => scheduleActiveHeadingUpdate()
    sourceScrollEl.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()

    return () => {
      sourceScrollEl.removeEventListener('scroll', handleScroll)
    }
  }, [sourceScrollEl, scheduleActiveHeadingUpdate])

  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [])

  const containerEl = document.querySelector('#editor-panel') as HTMLElement
  const scrollEl = document.querySelector('#editor-panel') as HTMLElement

  return (
    <TocViewContainer variant={variant}>
      <SideBarHeader name={t('sidebar.table_of_contents')} />
      <div style={{ height: 'calc(100% - 40px)', boxSizing: 'border-box' }}>
        <Toc
          ref={tocRef}
          containerEl={containerEl}
          scrollEl={scrollEl}
          variant={variant}
          compact={false}
          pinned
          activeId={activeHeadingId ?? undefined}
          toolbarFixed
        />
      </div>
    </TocViewContainer>
  )
}
