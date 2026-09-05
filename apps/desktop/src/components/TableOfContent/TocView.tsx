import { commandRegistry } from '@/commands'
import { EditorViewType } from '@/constants/editorViewType'
import { getHeadingValue } from '@/helper/string'
import { useEditorStore } from '@/stores'
import useEditorViewTypeStore from '@/stores/useEditorViewTypeStore'
import { TableOfContents } from '@markflowy/interface'
import type { IHeadingData, TableOfContentsRef } from '@markflowy/interface'
import { t } from '@/i18n'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { ListIcon } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import * as Rme from 'rme'
import { extractMatches } from 'rme'
import {
  getCapricornEditor,
  subscribeCapricornEditors,
} from '../EditorArea/capricornEditorRegistry'
import type {
  CapricornHeading,
  CapricornRuntimeAdapter,
} from '../EditorArea/capricornRuntimeAdapter'
import { sourceCodeCodemirrorViewMap } from '../EditorArea/TextEditor'
import SideBarHeader from '../SideBar/SideBarHeader'
import { CapricornHeadingNumberingButton } from './HeadingNumberingButton'
import { TocViewContainer } from './styles'
import { scheduleOutlineAfterPaint } from './scheduleOutlineAfterPaint'

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

type PendingCapricornOutline = {
  activeId: string
  editor: CapricornRuntimeAdapter
  deferred: boolean
  snapshot?: CapricornHeading[]
  cancel: () => void
}

const getHeadingChapterData = (
  headings: readonly { depth: number; value: string }[],
): { chapter?: string; value: string }[] => {
  const { analyzeHeadingNumbering } = Rme as typeof Rme & {
    analyzeHeadingNumbering: (inputs: readonly { level: number; text: string }[]) => {
      complete: boolean
      entries: { prefix: string | null; title: string }[]
    }
  }
  const analysis = analyzeHeadingNumbering(
    headings.map((heading) => ({ level: heading.depth, text: heading.value })),
  )

  if (!analysis.complete) {
    return headings.map((heading) => ({ value: heading.value }))
  }

  return analysis.entries.map((entry) => ({
    chapter: entry.prefix ?? undefined,
    value: entry.title,
  }))
}

const getActiveEditorScrollEl = (activeId: string): HTMLElement | null => {
  const activeEditor =
    Array.from(
      document.querySelectorAll<HTMLElement>('[data-editor-active="true"][data-editor-id]'),
    ).find((element) => element.dataset.editorId === activeId) ?? null

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
  headings: { pos: number; id: string }[]
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
  const [outlineSource, setOutlineSource] = useState<{
    id: string
    editor: CapricornRuntimeAdapter
  } | null>(null)
  const sourceHeadingsRef = useRef<SourceHeadingInfo[]>([])
  const capricornOutlineRef = useRef<{
    id: string
    editor: CapricornRuntimeAdapter
    headings: CapricornHeading[]
  } | null>(null)
  const wysiwygScrollElRef = useRef<HTMLElement | null>(null)
  const [wysiwygScrollEl, setWysiwygScrollEl] = useState<HTMLElement | null>(null)
  const sourceScrollElRef = useRef<HTMLElement | null>(null)
  const [sourceScrollEl, setSourceScrollEl] = useState<HTMLElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const sourceRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const capricornRefreshRef = useRef<PendingCapricornOutline | null>(null)
  const scheduleActiveHeadingUpdateRef = useRef<() => void>(() => {})
  const activeId = useEditorStore((state) => state.activeId)
  const activeViewType = useEditorViewTypeStore((state) =>
    activeId ? state.editorViewTypeMap.get(activeId) : undefined,
  )
  const getCapricornSnapshot = useCallback(
    () => (activeId ? getCapricornEditor(activeId) : undefined),
    [activeId],
  )
  const capricornEditor = useSyncExternalStore(
    subscribeCapricornEditors,
    getCapricornSnapshot,
    getCapricornSnapshot,
  )

  useEffect(() => {
    const outline = capricornOutlineRef.current
    if (
      outline &&
      (outline.id !== activeId ||
        outline.editor !== capricornEditor ||
        activeViewType !== EditorViewType.WYSIWYG)
    ) {
      capricornOutlineRef.current = null
      setActiveHeadingId(null)
    }
  }, [activeId, activeViewType, capricornEditor])

  const calculateActiveHeadingId = useCallback(() => {
    const currentActiveId = useEditorStore.getState().activeId
    if (!currentActiveId) return null

    const editorViewTypeMap = useEditorViewTypeStore.getState().editorViewTypeMap
    const viewType = editorViewTypeMap.get(currentActiveId)

    if (viewType === EditorViewType.WYSIWYG) {
      const outline = capricornOutlineRef.current
      const scrollEl = wysiwygScrollElRef.current
      if (
        !outline ||
        outline.id !== currentActiveId ||
        !scrollEl ||
        getCapricornEditor(currentActiveId) !== outline.editor
      )
        return null
      return outline.editor.getActiveHeadingId?.(outline.headings, scrollEl) ?? null
    }

    if (viewType === EditorViewType.SOURCECODE) {
      const codemirrorView = sourceCodeCodemirrorViewMap.get(currentActiveId)
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

  const scheduleCapricornHeadingRefresh = useCallback(
    (currentActiveId: string, editor: CapricornRuntimeAdapter, snapshot?: CapricornHeading[]) => {
      const isCurrentEditor = () =>
        useEditorStore.getState().activeId === currentActiveId &&
        useEditorViewTypeStore.getState().editorViewTypeMap.get(currentActiveId) ===
          EditorViewType.WYSIWYG &&
        getCapricornEditor(currentActiveId) === editor
      // An already queued old-editor notification must not cancel the new
      // editor's valid deferred initial scan after subscription cleanup.
      if (!isCurrentEditor()) return
      const pending = capricornRefreshRef.current
      if (pending?.activeId === currentActiveId && pending.editor === editor) {
        // A notification arriving before first paint replaces the pending
        // snapshot, but must not pull outline work back onto the opening path.
        if (pending.deferred || snapshot === undefined) {
          if (snapshot !== undefined) pending.snapshot = snapshot
          return
        }
      }
      pending?.cancel()
      const refresh: PendingCapricornOutline = {
        activeId: currentActiveId,
        editor,
        deferred: snapshot === undefined,
        snapshot,
        cancel: () => {},
      }
      capricornRefreshRef.current = refresh
      // A burst only renders its latest outline. The runtime already analyzed a
      // notification snapshot, so reading it again would rescan the whole file.
      const run = () => {
        if (capricornRefreshRef.current !== refresh) return
        capricornRefreshRef.current = null
        if (!isCurrentEditor()) return
        const currentEditorPanelEl = document.querySelector('#editor-panel') as HTMLElement | null
        const nextScrollEl = getActiveEditorScrollEl(currentActiveId) ?? currentEditorPanelEl
        wysiwygScrollElRef.current = nextScrollEl
        setWysiwygScrollEl(nextScrollEl)
        setEditorPanelEl(currentEditorPanelEl)

        sourceHeadingsRef.current = []
        sourceScrollElRef.current = null
        setSourceScrollEl(null)

        const currentHeadings = refresh.snapshot ?? editor.headings.getAll()
        capricornOutlineRef.current = { id: currentActiveId, editor, headings: currentHeadings }
        const headings = currentHeadings.map((heading) => {
          return {
            depth: heading.level,
            value: heading.title || heading.text,
            chapter: heading.number ?? undefined,
            id: heading.id,
            htmlNode: null,
            onClick: () => {
              void editor.headings.jumpTo(heading.id, { offset: 100 }).then(() => {
                scheduleActiveHeadingUpdateRef.current()
              })
            },
          } as IHeadingData
        })

        tocRef.current?.refreshByHeadings({ newHeadings: headings })
        setOutlineSource((current) =>
          current?.id === currentActiveId && current.editor === editor
            ? current
            : { id: currentActiveId, editor },
        )
        scheduleActiveHeadingUpdateRef.current()
      }
      if (refresh.deferred) {
        refresh.cancel = scheduleOutlineAfterPaint(run)
      } else {
        const timer = setTimeout(run, 0)
        refresh.cancel = () => clearTimeout(timer)
      }
    },
    [],
  )

  useEffect(() => {
    const disposable = commandRegistry.registerCommand({
      id: 'app:toc_refresh',
      handler: () => {
        if (sourceRefreshTimerRef.current !== null) {
          clearTimeout(sourceRefreshTimerRef.current)
          sourceRefreshTimerRef.current = null
        }
        const currentActiveId = useEditorStore.getState().activeId
        const editorViewTypeMap = useEditorViewTypeStore.getState().editorViewTypeMap

        if (!currentActiveId) {
          tocRef.current?.refreshByHeadings({ newHeadings: [] })
          setActiveHeadingId(null)
          return
        }

        const viewType = editorViewTypeMap.get(currentActiveId)

        if (viewType === EditorViewType.SOURCECODE) {
          const codemirrorView = sourceCodeCodemirrorViewMap.get(currentActiveId)
          if (!codemirrorView) {
            // TextEditor publishes another refresh when CodeMirror finishes
            // loading. Avoid an unowned retry loop after a tab closes or its
            // mode changes.
            return
          }

          sourceRefreshTimerRef.current = setTimeout(() => {
            sourceRefreshTimerRef.current = null
            if (
              useEditorStore.getState().activeId !== currentActiveId ||
              useEditorViewTypeStore.getState().editorViewTypeMap.get(currentActiveId) !==
                EditorViewType.SOURCECODE ||
              sourceCodeCodemirrorViewMap.get(currentActiveId) !== codemirrorView
            ) {
              return
            }
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
            const chapterData = getHeadingChapterData(sourceHeadings)
            const nextScrollEl = resolveSourceScrollEl(currentActiveId, codemirrorView.cm.scrollDOM)
            sourceScrollElRef.current = nextScrollEl
            setSourceScrollEl(nextScrollEl)
            wysiwygScrollElRef.current = null
            setWysiwygScrollEl(null)

            const headings: IHeadingData[] = sourceHeadings.map((heading, index) => {
              return {
                depth: heading.depth,
                value: chapterData[index]?.value ?? heading.value,
                chapter: chapterData[index]?.chapter,
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
          const editor = getCapricornEditor(currentActiveId)
          if (!editor) {
            // The Capricorn registry subscription below schedules the initial
            // outline once the exact active runtime is ready.
            return
          }

          scheduleCapricornHeadingRefresh(currentActiveId, editor)
          return
        }

        tocRef.current?.refreshByHeadings({ newHeadings: [] })
        setActiveHeadingId(null)
        wysiwygScrollElRef.current = null
        setWysiwygScrollEl(null)
        sourceHeadingsRef.current = []
        sourceScrollElRef.current = null
        setSourceScrollEl(null)
      },
    })

    return () => disposable.dispose()
  }, [scheduleCapricornHeadingRefresh])

  useEffect(() => {
    const currentEditorPanelEl = document.querySelector('#editor-panel') as HTMLElement | null
    const scrollEl = activeId ? getActiveEditorScrollEl(activeId) : null
    setEditorPanelEl(currentEditorPanelEl)
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
    // Virtualized blocks may mount after the scroll frame. Re-evaluate the
    // visible anchor then, using the same cached outline.
    const content = wysiwygScrollEl.querySelector('[data-cap-content]')
    const observer = new MutationObserver(handleScroll)
    if (content) observer.observe(content, { childList: true, subtree: true })
    const resizeObserver = new ResizeObserver(handleScroll)
    if (content) resizeObserver.observe(content)
    handleScroll()

    return () => {
      wysiwygScrollEl.removeEventListener('scroll', handleScroll)
      observer.disconnect()
      resizeObserver.disconnect()
    }
  }, [wysiwygScrollEl, scheduleActiveHeadingUpdate, capricornEditor, activeViewType])

  useEffect(() => {
    if (!sourceScrollEl) return

    const handleScroll = () => scheduleActiveHeadingUpdate()
    const currentActiveId = useEditorStore.getState().activeId
    const codemirrorView = currentActiveId ? sourceCodeCodemirrorViewMap.get(currentActiveId) : null
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
      if (sourceRefreshTimerRef.current !== null) {
        clearTimeout(sourceRefreshTimerRef.current)
        sourceRefreshTimerRef.current = null
      }
      capricornRefreshRef.current?.cancel()
      capricornRefreshRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!activeId) {
      tocRef.current?.refreshByHeadings({ newHeadings: [] })
      setActiveHeadingId(null)
      wysiwygScrollElRef.current = null
      setWysiwygScrollEl(null)
      sourceHeadingsRef.current = []
      sourceScrollElRef.current = null
      setSourceScrollEl(null)
      return
    }
    if (activeViewType === EditorViewType.WYSIWYG) return
    const timer = setTimeout(() => {
      commandRegistry.execute('app:toc_refresh')
    }, 300)
    return () => clearTimeout(timer)
  }, [activeId, activeViewType])

  useEffect(() => {
    if (!activeId || !capricornEditor || activeViewType !== EditorViewType.WYSIWYG) return

    scheduleCapricornHeadingRefresh(activeId, capricornEditor)
    const unsubscribe = capricornEditor.headings.subscribe((headings) => {
      scheduleCapricornHeadingRefresh(activeId, capricornEditor, headings)
    })
    return () => {
      unsubscribe()
      capricornRefreshRef.current?.cancel()
      capricornRefreshRef.current = null
    }
  }, [activeId, activeViewType, capricornEditor, scheduleCapricornHeadingRefresh])

  const headingNumberingAction =
    capricornEditor &&
    activeViewType === EditorViewType.WYSIWYG &&
    outlineSource?.id === activeId &&
    outlineSource?.editor === capricornEditor ? (
      <CapricornHeadingNumberingButton editor={capricornEditor} />
    ) : null

  return (
    <TocViewContainer variant={variant}>
      {headingNumberingAction ? (
        <SideBarHeader actions={headingNumberingAction} name={t('sidebar.table_of_contents')} />
      ) : null}
      <div
        style={{
          height: headingNumberingAction ? 'calc(100% - 32px)' : '100%',
          boxSizing: 'border-box',
        }}
      >
        <TableOfContents
          ref={tocRef}
          containerEl={editorPanelEl ?? undefined}
          scrollEl={editorPanelEl ?? undefined}
          variant={variant}
          compact={false}
          pinned
          activeId={activeHeadingId ?? undefined}
          toolbarFixed
          Empty={
            activeId ? (
              <Empty role='status'>
                <EmptyHeader>
                  <EmptyMedia>
                    <ListIcon aria-hidden='true' className='size-5' strokeWidth={1.5} />
                  </EmptyMedia>
                  <EmptyTitle>{t('sidebar.no_heading_lines')}</EmptyTitle>
                </EmptyHeader>
              </Empty>
            ) : null
          }
        />
      </div>
    </TocViewContainer>
  )
}
