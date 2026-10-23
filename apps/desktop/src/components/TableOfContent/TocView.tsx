import { commandRegistry } from '@/commands'
import { EditorViewType, isCapricornView } from '@/constants/editorViewType'
import { getHeadingValue } from '@/helper/string'
import { useEditorStore } from '@/stores'
import useEditorViewTypeStore from '@/stores/useEditorViewTypeStore'
import useFileTypeConfigStore from '@/stores/useFileTypeConfigStore'
import { TableOfContents } from '@markflowy/interface'
import type { IHeadingData, TableOfContentsRef } from '@markflowy/interface'
import { t } from '@/i18n'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { DropdownMenuItemPrimitive } from '@/components/ui/dropdown-menu'
import { useCommandShortcut } from '@/commands/useCommandShortcut'
import { DockPanelMenu } from '@/components/SideBar/DockPanelMenu'
import { ListIcon } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { ChangeDesc } from '@codemirror/state'
import type { MfCodemirrorView } from 'rme'
import { getLoadedRmeRuntime, type RmeRuntime } from '../EditorArea/rmeRuntime'
import {
  getCapricornEditor,
  subscribeCapricornEditors,
} from '../EditorArea/capricornEditorRegistry'
import type {
  CapricornHeading,
  CapricornRuntimeAdapter,
} from '../EditorArea/capricornRuntimeAdapter'
import {
  sourceCodeCodemirrorViewMap,
  subscribeSourceCodeEditors,
} from '../EditorArea/sourceCodeEditorRegistry'
import { getCapricornRuntimeInput } from '../EditorArea/capricornRuntimeDom'
import SideBarHeader from '../SideBar/SideBarHeader'
import { CapricornHeadingNumberingButton } from './HeadingNumberingButton'
import { TocViewContainer } from './styles'
import { scheduleOutlineAfterPaint } from './scheduleOutlineAfterPaint'
import { subscribeOutlineScrollIntent, subscribeSourceOutline } from './outlineTracking'
import { getOutlineSession, releaseOutlineSession, type OutlineSession, type OutlineSnapshot } from './outlineSession'
import { OUTLINE_COLLAPSE_ALL, OUTLINE_EXPAND_ALL, registerOutlineCommands } from './outlineCommands'

const emptyOutlineSnapshot: OutlineSnapshot = { collapsedIds: new Set(), headingCount: 0 }

function acquireOutlineSession(owner: object, fileId: string, mode: string, source?: MfCodemirrorView) {
  const session = getOutlineSession(owner, fileId, mode, source)
  session.watchLifetime((listener) => {
    const unsubscribeEditor = source ? subscribeSourceCodeEditors(listener) : subscribeCapricornEditors(listener)
    const unsubscribeMode = useEditorViewTypeStore.subscribe?.(listener)
    return () => { unsubscribeEditor(); unsubscribeMode?.() }
  }, () => useEditorViewTypeStore.getState().editorViewTypeMap.get(fileId) === mode &&
    (source ? sourceCodeCodemirrorViewMap.get(fileId) : getCapricornEditor(fileId)) === owner,
  () => releaseOutlineSession(owner))
  return session
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

type PendingCapricornOutline = {
  activeId: string
  editor: CapricornRuntimeAdapter
  deferred: boolean
  snapshot?: CapricornHeading[]
  cancel: () => void
}

const isMarkdownFile = (id: string) =>
  useFileTypeConfigStore.getState().fileTypeConfigMap.get(id)?.type === 'markdown'

const getHeadingChapterData = (
  headings: readonly { depth: number; value: string }[],
  runtime: RmeRuntime,
): { chapter?: string; value: string }[] => {
  const { analyzeHeadingNumbering } = runtime as RmeRuntime & {
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
  const [outlineSession, setOutlineSession] = useState<OutlineSession | null>(null)
  const outlineSessionRef = useRef<OutlineSession | null>(null)
  const outlineSnapshot = useSyncExternalStore(
    useCallback((listener) => outlineSession?.subscribe(listener) ?? (() => {}), [outlineSession]),
    useCallback(() => outlineSession?.getSnapshot() ?? emptyOutlineSnapshot, [outlineSession]),
  )
  const collapseShortcut = useCommandShortcut(OUTLINE_COLLAPSE_ALL)
  const expandShortcut = useCommandShortcut(OUTLINE_EXPAND_ALL)
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null)
  const [editorPanelEl, setEditorPanelEl] = useState<HTMLElement | null>(null)
  const [outlineSource, setOutlineSource] = useState<{
    id: string
    editor: CapricornRuntimeAdapter
  } | null>(null)
  const sourceHeadingsRef = useRef<SourceHeadingInfo[]>([])
  const sourceOutlineRef = useRef<{
    id: string
    editor: MfCodemirrorView
    changes: ChangeDesc | null
  } | null>(null)
  const [sourceOutlineEditor, setSourceOutlineEditor] = useState<MfCodemirrorView | null>(null)
  const activeHeadingSourceRef = useRef<'viewport' | 'selection'>('viewport')
  const headingIntentRef = useRef(0)
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
  const activeIsMarkdown = useFileTypeConfigStore(
    (state) => state.fileTypeConfigMap.get(activeId ?? '')?.type === 'markdown',
  )
  const activeViewType = useEditorViewTypeStore((state) =>
    activeId ? state.editorViewTypeMap.get(activeId) : undefined,
  )
  const getCapricornSnapshot = useCallback(
    () => (activeId && activeIsMarkdown ? getCapricornEditor(activeId) : undefined),
    [activeId, activeIsMarkdown],
  )
  const capricornEditor = useSyncExternalStore(
    subscribeCapricornEditors,
    getCapricornSnapshot,
    getCapricornSnapshot,
  )
  const getSourceSnapshot = useCallback(
    () => (activeId && activeIsMarkdown ? sourceCodeCodemirrorViewMap.get(activeId) : undefined),
    [activeId, activeIsMarkdown],
  )
  const sourceEditor = useSyncExternalStore(
    subscribeSourceCodeEditors,
    getSourceSnapshot,
    getSourceSnapshot,
  )

  useEffect(() => {
    activeHeadingSourceRef.current = 'viewport'
    headingIntentRef.current++
  }, [activeId, activeViewType, capricornEditor, sourceEditor])

  useEffect(() => () => {
    if (!activeId) return
    const mode = useEditorViewTypeStore.getState().editorViewTypeMap.get(activeId)
    if (sourceEditor && (mode !== activeViewType || sourceCodeCodemirrorViewMap.get(activeId) !== sourceEditor)) {
      releaseOutlineSession(sourceEditor)
    }
    if (capricornEditor && (mode !== activeViewType || getCapricornEditor(activeId) !== capricornEditor)) {
      releaseOutlineSession(capricornEditor)
    }
  }, [activeId, activeViewType, sourceEditor, capricornEditor])

  const clearOutline = useCallback(() => {
    if (sourceRefreshTimerRef.current !== null) {
      clearTimeout(sourceRefreshTimerRef.current)
      sourceRefreshTimerRef.current = null
    }
    capricornRefreshRef.current?.cancel()
    capricornRefreshRef.current = null
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    tocRef.current?.refreshByHeadings({ newHeadings: [] })
    outlineSessionRef.current = null
    setOutlineSession(null)
    setActiveHeadingId(null)
    capricornOutlineRef.current = null
    setOutlineSource(null)
    wysiwygScrollElRef.current = null
    setWysiwygScrollEl(null)
    sourceHeadingsRef.current = []
    sourceOutlineRef.current = null
    setSourceOutlineEditor(null)
    activeHeadingSourceRef.current = 'viewport'
    headingIntentRef.current++
    sourceScrollElRef.current = null
    setSourceScrollEl(null)
  }, [])

  useEffect(() => registerOutlineCommands({
    isCurrent: () => {
      const id = useEditorStore.getState().activeId
      if (!id || !isMarkdownFile(id)) return false
      const mode = useEditorViewTypeStore.getState().editorViewTypeMap.get(id)
      const session = outlineSessionRef.current
      if (!session || session.fileId !== id || session.mode !== mode || !session.getSnapshot().headingCount) return false
      if (mode === EditorViewType.SOURCECODE) {
        const outline = sourceOutlineRef.current
        return outline?.id === id && outline.editor === sourceCodeCodemirrorViewMap.get(id)
      }
      const outline = capricornOutlineRef.current
      return isCapricornView(mode) && outline?.id === id && outline.editor === getCapricornEditor(id)
    },
    collapseAll: () => tocRef.current?.collapseAll(),
    expandAll: () => tocRef.current?.expandAll(),
  }), [])

  useEffect(() => {
    const outline = capricornOutlineRef.current
    if (
      outline &&
      (outline.id !== activeId ||
        outline.editor !== capricornEditor ||
        !isCapricornView(activeViewType))
    ) {
      capricornOutlineRef.current = null
      setActiveHeadingId(null)
    }
  }, [activeId, activeViewType, capricornEditor])

  const calculateActiveHeadingId = useCallback(() => {
    const currentActiveId = useEditorStore.getState().activeId
    if (!currentActiveId || !isMarkdownFile(currentActiveId)) return null

    const editorViewTypeMap = useEditorViewTypeStore.getState().editorViewTypeMap
    const viewType = editorViewTypeMap.get(currentActiveId)

    if (isCapricornView(viewType)) {
      const outline = capricornOutlineRef.current
      const scrollEl = wysiwygScrollElRef.current
      if (
        !outline ||
        outline.id !== currentActiveId ||
        !scrollEl ||
        getCapricornEditor(currentActiveId) !== outline.editor
      )
        return null
      return activeHeadingSourceRef.current === 'selection' && viewType === EditorViewType.WYSIWYG
        ? (outline.editor.getSelectionHeadingId?.(outline.headings) ?? null)
        : (outline.editor.getActiveHeadingId?.(outline.headings, scrollEl) ?? null)
    }

    if (viewType === EditorViewType.SOURCECODE) {
      const codemirrorView = sourceCodeCodemirrorViewMap.get(currentActiveId)
      const outline = sourceOutlineRef.current
      if (!codemirrorView || outline?.id !== currentActiveId || outline.editor !== codemirrorView) {
        return null
      }
      const position = (pos: number) => outline.changes?.mapPos(pos, 1) ?? pos
      if (activeHeadingSourceRef.current === 'selection') {
        const head = codemirrorView.cm.state.selection.main.head
        const headings = sourceHeadingsRef.current
        let start = 0
        let end = headings.length
        while (start < end) {
          const middle = (start + end) >>> 1
          if (position(headings[middle].pos) <= head) start = middle + 1
          else end = middle
        }
        return headings[start - 1]?.id ?? null
      }

      return resolveActiveHeadingId({
        headings: sourceHeadingsRef.current,
        scrollEl: sourceScrollElRef.current,
        getCoords: (pos) => {
          const cmEditorEl = codemirrorView.cm.dom
          if (!cmEditorEl) {
            return null
          }

          const lineBlock = codemirrorView.cm.lineBlockAt(position(pos))
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
        isMarkdownFile(currentActiveId) &&
        isCapricornView(useEditorViewTypeStore.getState().editorViewTypeMap.get(currentActiveId)) &&
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
        sourceOutlineRef.current = null
        setSourceOutlineEditor(null)
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
              activeHeadingSourceRef.current = 'viewport'
              headingIntentRef.current++
              void editor.headings.jumpTo(heading.id, { offset: 100 }).then(() => {
                scheduleActiveHeadingUpdateRef.current()
              })
            },
          } as IHeadingData
        })

        const mode = useEditorViewTypeStore.getState().editorViewTypeMap.get(currentActiveId)!
        const session = acquireOutlineSession(editor, currentActiveId, mode)
        session.refresh(headings)
        outlineSessionRef.current = session
        setOutlineSession(session)
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

        // Preview and Source Code modes are also used by non-Markdown files.
        // Only the active file's classification grants outline ownership.
        if (!currentActiveId || !isMarkdownFile(currentActiveId)) {
          clearOutline()
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
              !isMarkdownFile(currentActiveId) ||
              useEditorViewTypeStore.getState().editorViewTypeMap.get(currentActiveId) !==
                EditorViewType.SOURCECODE ||
              sourceCodeCodemirrorViewMap.get(currentActiveId) !== codemirrorView
            ) {
              return
            }
            // A registered source view has already loaded the engine. The
            // Capricorn outline never needs to import or initialize RME.
            const runtime = getLoadedRmeRuntime()
            if (!runtime) return
            const matches = runtime.extractMatches(codemirrorView.cm)
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
            sourceOutlineRef.current = {
              id: currentActiveId,
              editor: codemirrorView,
              changes: null,
            }
            setSourceOutlineEditor(codemirrorView)
            const chapterData = getHeadingChapterData(sourceHeadings, runtime)
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
                  const outline = sourceOutlineRef.current
                  const pos =
                    outline?.editor === codemirrorView
                      ? (outline.changes?.mapPos(heading.pos, 1) ?? heading.pos)
                      : heading.pos
                  codemirrorView.cm.dispatch({
                    selection: {
                      anchor: pos,
                      head: pos,
                    },
                    scrollIntoView: true,
                  })
                  codemirrorView.cm.focus()
                  activeHeadingSourceRef.current = 'selection'
                  headingIntentRef.current++
                  scheduleActiveHeadingUpdateRef.current()
                },
              }
            })
            const session = acquireOutlineSession(codemirrorView, currentActiveId, EditorViewType.SOURCECODE, codemirrorView)
            session.refresh(headings, new Map(sourceHeadings.map((heading) => [heading.id, heading.pos])))
            outlineSessionRef.current = session
            setOutlineSession(session)
            tocRef.current?.refreshByHeadings({ newHeadings: headings })
            scheduleActiveHeadingUpdateRef.current()
          }, 0)
          return
        }

        if (isCapricornView(viewType)) {
          const editor = getCapricornEditor(currentActiveId)
          if (!editor) {
            // The Capricorn registry subscription below schedules the initial
            // outline once the exact active runtime is ready.
            return
          }

          scheduleCapricornHeadingRefresh(currentActiveId, editor)
          return
        }

        clearOutline()
      },
    })

    return () => disposable.dispose()
  }, [clearOutline, scheduleCapricornHeadingRefresh])

  useEffect(() => {
    const currentEditorPanelEl = document.querySelector('#editor-panel') as HTMLElement | null
    const scrollEl = activeId && activeIsMarkdown ? getActiveEditorScrollEl(activeId) : null
    setEditorPanelEl(currentEditorPanelEl)
    if (!scrollEl) {
      wysiwygScrollElRef.current = null
      setWysiwygScrollEl(null)
      return
    }

    wysiwygScrollElRef.current = scrollEl
    setWysiwygScrollEl(scrollEl)
  }, [activeId, activeIsMarkdown])

  useEffect(() => {
    if (!wysiwygScrollEl) return
    const handleScroll = () => scheduleActiveHeadingUpdate()
    const unsubscribeIntent = subscribeOutlineScrollIntent(wysiwygScrollEl, () => {
      activeHeadingSourceRef.current = 'viewport'
      headingIntentRef.current++
    })
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
      unsubscribeIntent()
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
    const unsubscribeIntents = scrollTargets.map((target) =>
      subscribeOutlineScrollIntent(target, () => {
        activeHeadingSourceRef.current = 'viewport'
        headingIntentRef.current++
      }),
    )
    handleScroll()

    return () => {
      unsubscribeIntents.forEach((unsubscribe) => unsubscribe())
      scrollTargets.forEach((scrollTarget) => {
        scrollTarget.removeEventListener('scroll', handleScroll)
      })
    }
  }, [sourceScrollEl, sourceEditor, scheduleActiveHeadingUpdate])

  useEffect(() => {
    if (
      !activeId ||
      !activeIsMarkdown ||
      activeViewType !== EditorViewType.WYSIWYG ||
      !capricornEditor?.resume
    )
      return
    let disposed = false
    let selectionFrame: number | null = null
    let pendingSelectionIntent: number | null = null
    let previous = JSON.stringify(capricornEditor.resume.capture())
    const isCurrentEditor = () =>
      !disposed &&
      useEditorStore.getState().activeId === activeId &&
      isMarkdownFile(activeId) &&
      useEditorViewTypeStore.getState().editorViewTypeMap.get(activeId) ===
        EditorViewType.WYSIWYG &&
      getCapricornEditor(activeId) === capricornEditor
    const ownsEditorTarget = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return false
      const pane = getActiveEditorScrollEl(activeId)
      if (!pane) return false
      if (target === getCapricornRuntimeInput(pane)) return true
      const content = pane.querySelector('[data-cap-content]')
      if (!content || target.closest('[data-cap-content]') !== content) return false
      // Embedded code editors live inside a non-editable block; their actual
      // input still belongs to this document. Block tools and nested runtimes do not.
      if (target.closest('.cm-content[contenteditable="true"]')) return true
      return !target.closest(
        '[data-cap-not-editable], [data-cap-avoid-click-focus], [data-cap-selection-ignore], button, input, select, textarea, [role="button"], [role="combobox"]',
      )
    }
    const cancelPendingSelection = () => {
      pendingSelectionIntent = null
      if (selectionFrame !== null) cancelAnimationFrame(selectionFrame)
      selectionFrame = null
    }
    const scheduleSelection = (intent: number) => {
      if (selectionFrame !== null) cancelAnimationFrame(selectionFrame)
      selectionFrame = requestAnimationFrame(() => {
        selectionFrame = null
        if (
          !isCurrentEditor() ||
          pendingSelectionIntent !== intent ||
          headingIntentRef.current !== intent
        ) {
          pendingSelectionIntent = null
          return
        }
        // WebKit can transfer focus after this frame. Keep the same intent for
        // focusin to retry, so a newer wheel/scrollbar gesture can still cancel it.
        if (!ownsEditorTarget(document.activeElement)) return
        pendingSelectionIntent = null
        if (!capricornEditor.resume?.capture()) return
        activeHeadingSourceRef.current = 'selection'
        updateActiveHeadingId()
      })
    }
    const followSelection = () => {
      if (!isCurrentEditor()) return
      pendingSelectionIntent = ++headingIntentRef.current
      scheduleSelection(pendingSelectionIntent)
    }
    const unsubscribe = capricornEditor.resume.subscribe(() => {
      if (!isCurrentEditor()) return
      const next = JSON.stringify(capricornEditor.resume?.capture())
      if (previous === next) return
      previous = next
      followSelection()
    })
    const onFocusIn = (event: FocusEvent) => {
      if (!isCurrentEditor() || !ownsEditorTarget(event.target)) {
        cancelPendingSelection()
        return
      }
      // Runtime selection repair also blurs/refocuses its input. Focus alone
      // must not switch a manually scrolled document back to caret following.
      if (pendingSelectionIntent !== null) scheduleSelection(pendingSelectionIntent)
    }
    const onClick = (event: MouseEvent) => {
      if (ownsEditorTarget(event.target)) followSelection()
      else cancelPendingSelection()
    }
    // Capture also sees events stopped by embedded editors. Read selection in
    // the next frame, after the runtime's click handler has finished updating it.
    document.addEventListener('focusin', onFocusIn, true)
    document.addEventListener('click', onClick, true)
    return () => {
      disposed = true
      cancelPendingSelection()
      unsubscribe()
      document.removeEventListener('focusin', onFocusIn, true)
      document.removeEventListener('click', onClick, true)
    }
  }, [activeId, activeIsMarkdown, activeViewType, capricornEditor, updateActiveHeadingId])

  useEffect(() => {
    if (
      !activeId ||
      !activeIsMarkdown ||
      activeViewType !== EditorViewType.SOURCECODE ||
      !sourceEditor ||
      sourceOutlineEditor !== sourceEditor
    )
      return
    let disposed = false
    const unsubscribe = subscribeSourceOutline(sourceEditor, (update) => {
      if (
        disposed ||
        useEditorStore.getState().activeId !== activeId ||
        !isMarkdownFile(activeId) ||
        useEditorViewTypeStore.getState().editorViewTypeMap.get(activeId) !==
          EditorViewType.SOURCECODE ||
        sourceCodeCodemirrorViewMap.get(activeId) !== sourceEditor
      )
        return
      const outline = sourceOutlineRef.current
      if (update.docChanged && outline?.editor === sourceEditor) {
        outline.changes = outline.changes?.composeDesc(update.changes.desc) ?? update.changes.desc
      }
      if (
        update.view.hasFocus &&
        (update.docChanged || !update.startState.selection.eq(update.state.selection))
      ) {
        activeHeadingSourceRef.current = 'selection'
        headingIntentRef.current++
        scheduleActiveHeadingUpdate()
      }
    })
    return () => {
      disposed = true
      unsubscribe()
    }
  }, [
    activeId,
    activeIsMarkdown,
    activeViewType,
    sourceEditor,
    sourceOutlineEditor,
    scheduleActiveHeadingUpdate,
  ])

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
    if (!activeId || !activeIsMarkdown) {
      clearOutline()
      return
    }
    if (isCapricornView(activeViewType)) return
    const timer = setTimeout(() => {
      commandRegistry.execute('app:toc_refresh')
    }, 300)
    return () => clearTimeout(timer)
  }, [activeId, activeViewType, activeIsMarkdown, sourceEditor, clearOutline])

  useEffect(() => {
    if (!activeId || !activeIsMarkdown || !capricornEditor || !isCapricornView(activeViewType))
      return

    scheduleCapricornHeadingRefresh(activeId, capricornEditor)
    const unsubscribe = capricornEditor.headings.subscribe((headings) => {
      scheduleCapricornHeadingRefresh(activeId, capricornEditor, headings)
    })
    return () => {
      unsubscribe()
      capricornRefreshRef.current?.cancel()
      capricornRefreshRef.current = null
    }
  }, [activeId, activeViewType, activeIsMarkdown, capricornEditor, scheduleCapricornHeadingRefresh])

  const headingNumberingAction =
    activeIsMarkdown &&
    capricornEditor &&
    activeViewType === EditorViewType.WYSIWYG &&
    outlineSource?.id === activeId &&
    outlineSource?.editor === capricornEditor ? (
      <CapricornHeadingNumberingButton editor={capricornEditor} />
    ) : null

  const canFold = Boolean(activeIsMarkdown && outlineSession && outlineSession.fileId === activeId &&
    outlineSession.mode === activeViewType && outlineSnapshot.headingCount > 0)

  return (
    <TocViewContainer variant={variant}>
      <SideBarHeader
        actions={<>
          {headingNumberingAction}
          <DockPanelMenu panelId='toc'>
            <DropdownMenuItemPrimitive disabled={!canFold} onSelect={() => { void commandRegistry.execute(OUTLINE_COLLAPSE_ALL) }}>
              {t('sidebar.outline_collapse_all')}
              <span className='ml-auto pl-4 text-ui-caption text-muted-foreground'>{collapseShortcut}</span>
            </DropdownMenuItemPrimitive>
            <DropdownMenuItemPrimitive disabled={!canFold} onSelect={() => { void commandRegistry.execute(OUTLINE_EXPAND_ALL) }}>
              {t('sidebar.outline_expand_all')}
              <span className='ml-auto pl-4 text-ui-caption text-muted-foreground'>{expandShortcut}</span>
            </DropdownMenuItemPrimitive>
          </DockPanelMenu>
        </>}
        name={t('sidebar.table_of_contents')}
        title={t('sidebar.table_of_contents')}
      />
      <div
        style={{
          height: 'calc(100% - 32px)',
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
          collapsible
          collapsedHeadingIds={outlineSnapshot.collapsedIds}
          onCollapsedHeadingIdsChange={outlineSession?.setCollapsedIds}
          collapseLabel={t('sidebar.outline_collapse')}
          expandLabel={t('sidebar.outline_expand')}
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
