import { commandRegistry } from '@/commands'
import { getHeadingValue } from '@/helper/string'
import { useEditorStore } from '@/stores'
import useEditorViewTypeStore from '@/stores/useEditorViewTypeStore'
import { TableOfContents, TableOfContentsRef, IHeadingData } from '@markflowy/interface'
import { t } from '@/i18n'
import type { Node as ProseMirrorNode } from 'prosemirror-model'
import { TextSelection } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'
import { useCallback, useEffect, useRef, useState } from 'react'
import { EditorViewType, extractMatches } from 'rme'
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

type HeadingViewportCoords = {
  top: number
  bottom?: number
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

const getActiveEditorScrollEl = (activeId: string): HTMLElement | null => {
  const activeEditor = Array.from(
    document.querySelectorAll<HTMLElement>('[data-editor-active="true"][data-editor-id]'),
  ).find((element) => element.dataset.editorId === activeId)

  return (
    (activeEditor?.querySelector('[data-overlayscrollbars-viewport]') as HTMLElement | null) ||
    (activeEditor?.querySelector('.os-viewport') as HTMLElement | null) ||
    activeEditor
  )
}

const resolveSourceScrollEl = (activeId: string, codemirrorScrollEl: HTMLElement) => {
  if (codemirrorScrollEl.scrollHeight > codemirrorScrollEl.clientHeight + 1) {
    return codemirrorScrollEl
  }

  return getActiveEditorScrollEl(activeId) ?? codemirrorScrollEl
}

const resolveActiveHeadingId = (params: {
  headings: Array<{ pos: number; id: string }>
  scrollEl: HTMLElement | null
  getCoords: (pos: number) => HeadingViewportCoords | null
  offset?: number
}): string | null => {
  const { headings, scrollEl, getCoords, offset = 16 } = params
  if (!scrollEl || headings.length === 0) {
    return null
  }

  const containerRect = scrollEl.getBoundingClientRect()
  const viewportTop = containerRect.top + offset
  const viewportBottom = containerRect.bottom
  let currentId: string | null = headings[0]?.id ?? null
  let firstVisibleId: string | null = null

  for (const heading of headings) {
    try {
      const coords = getCoords(heading.pos)
      if (!coords) {
        continue
      }

      const headingTop = coords.top
      const headingBottom = coords.bottom ?? coords.top
      const isVisible = headingBottom >= viewportTop && headingTop <= viewportBottom

      if (isVisible) {
        firstVisibleId = heading.id
        break
      }

      if (headingTop < viewportTop) {
        currentId = heading.id
      } else {
        break
      }
    } catch (error) {
      continue
    }
  }

  return firstVisibleId ?? currentId
}

type TocViewProps = {
  variant?: 'sidebar' | 'editor'
}

export const TocView = ({ variant = 'sidebar' }: TocViewProps) => {
  const tocRef = useRef<TableOfContentsRef>(null)
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null)
  const [editorPanelEl, setEditorPanelEl] = useState<HTMLElement | null>(null)
  const wysiwygHeadingsRef = useRef<HeadingInfo[]>([])
  const sourceHeadingsRef = useRef<SourceHeadingInfo[]>([])
  const wysiwygScrollElRef = useRef<HTMLElement | null>(null)
  const [wysiwygScrollEl, setWysiwygScrollEl] = useState<HTMLElement | null>(null)
  const sourceScrollElRef = useRef<HTMLElement | null>(null)
  const [sourceScrollEl, setSourceScrollEl] = useState<HTMLElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const scheduleActiveHeadingUpdateRef = useRef<() => void>(() => {})
  const activeId = useEditorStore((state) => state.activeId)

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
        getCoords: (pos) => {
          const coords = editorView.coordsAtPos(pos)
          return { top: coords.top, bottom: coords.bottom }
        },
      })
    }

    if (viewType === EditorViewType.SOURCECODE) {
      const codemirrorView = sourceCodeCodemirrorViewMap.get(activeId)
      if (!codemirrorView) {
        return null
      }

      return resolveActiveHeadingId({
        headings: sourceHeadingsRef.current,
        scrollEl: sourceScrollElRef.current,
        getCoords: (pos) => {
          const cmEditorEl = codemirrorView.cm.dom
          if (!cmEditorEl) {
            return null
          }

          const lineBlock = codemirrorView.cm.lineBlockAt(pos)
          const viewportEl = sourceScrollElRef.current
          const baseRect =
            viewportEl === codemirrorView.cm.scrollDOM
              ? codemirrorView.cm.scrollDOM.getBoundingClientRect()
              : cmEditorEl.getBoundingClientRect()
          const cmScrollTop = codemirrorView.cm.scrollDOM.scrollTop

          return {
            top: baseRect.top + lineBlock.top - cmScrollTop,
            bottom: baseRect.top + lineBlock.bottom - cmScrollTop,
          }
        },
      })
    }

    return null
  }, [])

  const updateActiveHeadingId = useCallback(() => {
    const nextActiveId = calculateActiveHeadingId()
    setActiveHeadingId((currentActiveId) =>
      currentActiveId === nextActiveId ? currentActiveId : nextActiveId,
    )
  }, [calculateActiveHeadingId])

  const scheduleActiveHeadingUpdate = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
    }

    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      updateActiveHeadingId()
    })
  }, [updateActiveHeadingId])

  useEffect(() => {
    scheduleActiveHeadingUpdateRef.current = scheduleActiveHeadingUpdate
  }, [scheduleActiveHeadingUpdate])

  useEffect(() => {
    const disposable = commandRegistry.registerCommand({
      id: 'app:toc_refresh',
      handler: () => {
        const activeId = useEditorStore.getState().activeId
        const editorViewTypeMap = useEditorViewTypeStore.getState().editorViewTypeMap

        if (!activeId) {
          tocRef.current?.refreshByHeadings({ newHeadings: [] })
          setActiveHeadingId(null)
          return
        }

        const viewType = editorViewTypeMap.get(activeId)

        if (viewType === EditorViewType.SOURCECODE) {
          const codemirrorView = sourceCodeCodemirrorViewMap.get(activeId)
          if (!codemirrorView) {
            setTimeout(() => {
              commandRegistry.execute('app:toc_refresh')
            }, 500)
            return
          }

          setTimeout(() => {
            const matches = extractMatches(codemirrorView.cm)
            const sourceHeadings: SourceHeadingInfo[] = matches.map((match) => {
              const depth = Number(match.type.split('ATXHeading')?.[1]) || 1
              const value = getHeadingValue(match.value)
              const pos = match.from

              return {
                depth,
                value,
                pos,
                id: `heading-${pos}`,
              }
            })

            sourceHeadingsRef.current = sourceHeadings
            const nextScrollEl = resolveSourceScrollEl(activeId, codemirrorView.cm.scrollDOM)
            sourceScrollElRef.current = nextScrollEl
            setSourceScrollEl(nextScrollEl)
            wysiwygHeadingsRef.current = []
            wysiwygScrollElRef.current = null
            setWysiwygScrollEl(null)

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
                  scheduleActiveHeadingUpdateRef.current()
                },
              }
            })
            tocRef.current?.refreshByHeadings({ newHeadings: headings })
            scheduleActiveHeadingUpdateRef.current()
          }, 0)
          return
        }

        if (viewType === EditorViewType.WYSIWYG) {
          const editorDelegate = useEditorStore.getState().getEditorDelegate(activeId)
          const editorView = editorDelegate?.manager?.view
          if (!editorView) {
            setTimeout(() => {
              commandRegistry.execute('app:toc_refresh')
            }, 500)
            return
          }

          setTimeout(() => {
            const editorPanelEl = document.querySelector('#editor-panel') as HTMLElement | null
            const nextScrollEl = getActiveEditorScrollEl(activeId) ?? editorPanelEl
            wysiwygScrollElRef.current = nextScrollEl
            setWysiwygScrollEl(nextScrollEl)
            setEditorPanelEl(editorPanelEl)

            const headingInfos = getAllHeadings(editorView.state.doc)
            wysiwygHeadingsRef.current = headingInfos
            sourceHeadingsRef.current = []
            sourceScrollElRef.current = null
            setSourceScrollEl(null)

            const headings = headingInfos.map((heading) => {
              return {
                depth: heading.level,
                value: heading.text,
                id: heading.id,
                htmlNode: null,
                onClick: () => {
                  jumpToHeading(editorView, heading.pos, wysiwygScrollElRef.current)
                  scheduleActiveHeadingUpdateRef.current()
                },
              } as IHeadingData
            })

            tocRef.current?.refreshByHeadings({ newHeadings: headings })
            scheduleActiveHeadingUpdateRef.current()
          }, 0)
          return
        }

        tocRef.current?.refreshByHeadings({ newHeadings: [] })
        setActiveHeadingId(null)
        wysiwygHeadingsRef.current = []
        wysiwygScrollElRef.current = null
        setWysiwygScrollEl(null)
        sourceHeadingsRef.current = []
        sourceScrollElRef.current = null
        setSourceScrollEl(null)
      },
    })

    return () => disposable.dispose()
  }, [])

  useEffect(() => {
    const editorPanelEl = document.querySelector('#editor-panel') as HTMLElement | null
    const scrollEl = activeId ? getActiveEditorScrollEl(activeId) : null
    setEditorPanelEl(editorPanelEl)
    if (!scrollEl) {
      wysiwygScrollElRef.current = null
      setWysiwygScrollEl(null)
      return
    }

    wysiwygScrollElRef.current = scrollEl
    setWysiwygScrollEl(scrollEl)
  }, [activeId])

  useEffect(() => {
    if (!wysiwygScrollEl) return
    const handleScroll = () => scheduleActiveHeadingUpdate()
    wysiwygScrollEl.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()

    return () => {
      wysiwygScrollEl.removeEventListener('scroll', handleScroll)
    }
  }, [wysiwygScrollEl, scheduleActiveHeadingUpdate])

  useEffect(() => {
    if (!sourceScrollEl) return

    const handleScroll = () => scheduleActiveHeadingUpdate()
    const activeId = useEditorStore.getState().activeId
    const codemirrorView = activeId ? sourceCodeCodemirrorViewMap.get(activeId) : null
    const scrollTargets = Array.from(
      new Set([sourceScrollEl, codemirrorView?.cm.scrollDOM].filter(Boolean)),
    ) as HTMLElement[]

    scrollTargets.forEach((scrollTarget) => {
      scrollTarget.addEventListener('scroll', handleScroll, { passive: true })
    })
    handleScroll()

    return () => {
      scrollTargets.forEach((scrollTarget) => {
        scrollTarget.removeEventListener('scroll', handleScroll)
      })
    }
  }, [sourceScrollEl, scheduleActiveHeadingUpdate])

  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!activeId) {
      tocRef.current?.refreshByHeadings({ newHeadings: [] })
      setActiveHeadingId(null)
      wysiwygHeadingsRef.current = []
      wysiwygScrollElRef.current = null
      setWysiwygScrollEl(null)
      sourceHeadingsRef.current = []
      sourceScrollElRef.current = null
      setSourceScrollEl(null)
      return
    }
    const timer = setTimeout(() => {
      commandRegistry.execute('app:toc_refresh')
    }, 300)
    return () => clearTimeout(timer)
  }, [activeId])

  return (
    <TocViewContainer variant={variant}>
      <SideBarHeader name={t('sidebar.table_of_contents')} />
      <div style={{ height: 'calc(100% - 40px)', boxSizing: 'border-box' }}>
        <TableOfContents
          ref={tocRef}
          containerEl={editorPanelEl ?? undefined}
          scrollEl={editorPanelEl ?? undefined}
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
