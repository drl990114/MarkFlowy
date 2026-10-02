import { useEffect, useRef, useState, type ReactNode } from 'react'
import { EditorState, type Text } from '@codemirror/state'
import { EditorView, lineNumbers } from '@codemirror/view'
import {
  Change,
  MergeView,
  getChunks,
  getOriginalDoc,
  unifiedMergeView,
  type Chunk,
} from '@codemirror/merge'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  Columns2Icon,
  Rows2Icon,
  UnfoldVerticalIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useTranslation } from '@/i18n'
import type { HistoryComparisonProps } from './HistoryDiffPreview'
import './historyDiff.css'

function DiffButton({
  label,
  children,
  ...props
}: {
  label: string
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  'aria-pressed'?: boolean
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant='chrome' size='icon-sm' aria-label={label} {...props}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function changedLines(doc: Text, from: number, to: number) {
  if (from === to || !doc.length) return 0
  // A final newline terminates the last line; it is not another removed/added line.
  return doc.lineAt(Math.min(to - 1, doc.length - 1)).number - doc.lineAt(from).number + 1
}

export default function HistoryDiff({
  before,
  after,
  beforeLabel,
  afterLabel,
}: HistoryComparisonProps) {
  const container = useRef<HTMLDivElement>(null)
  const navigate = useRef<(direction: number) => void>(() => {})
  const active = useRef(-1)
  const cached = useRef<
    | {
        before: string
        after: string
        changes?: Change[]
        coarse: boolean
      }
    | undefined
  >(undefined)
  const [mode, setMode] = useState<'split' | 'unified'>('split')
  const [fullContext, setFullContext] = useState(false)
  const [summary, setSummary] = useState({
    ready: false,
    total: 0,
    added: 0,
    removed: 0,
    coarse: false,
  })
  const [current, setCurrent] = useState(0)
  const { t } = useTranslation()
  const leftLabel = beforeLabel ?? t('history.before')
  const rightLabel = afterLabel ?? t('history.after')
  const unchangedPhrase = t('history.unchanged_lines')

  useEffect(() => {
    if (!container.current) return
    if (cached.current?.before !== before || cached.current?.after !== after) {
      cached.current = undefined
      active.current = -1
    }
    setSummary({ ready: false, total: 0, added: 0, removed: 0, coarse: false })
    setCurrent(0)
    let merge: MergeView | undefined
    let unified: EditorView | undefined
    let worker: Worker | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    let disposed = false

    const mount = (changes?: Change[], coarse = false) => {
      if (disposed || !container.current || merge || unified) return
      worker?.terminate()
      clearTimeout(timer)
      cached.current = { before, after, changes, coarse }
      const extensions = [
        EditorState.readOnly.of(true),
        EditorView.editable.of(false),
        // Fixed-height rows keep split panes aligned through virtualized, CJK
        // context. Unified view wraps prose without a second pane to align.
        mode === 'unified' ? EditorView.lineWrapping : [],
        lineNumbers(),
        EditorState.phrases.of({ '$ unchanged lines': unchangedPhrase }),
      ]
      const attributes = (label: string) =>
        EditorView.contentAttributes.of({
          'aria-label': label,
          'aria-readonly': 'true',
          tabindex: '0',
        })
      const diffConfig = {
        scanLimit: 1000,
        timeout: 100,
        ...(changes ? { override: () => changes } : {}),
      }
      const collapseUnchanged = fullContext ? undefined : { margin: 3, minSize: 6 }
      let chunks: readonly Chunk[]
      let docA: Text
      let docB: Text
      if (mode === 'split') {
        merge = new MergeView({
          parent: container.current,
          a: { doc: before, extensions: [...extensions, attributes(leftLabel)] },
          b: { doc: after, extensions: [...extensions, attributes(rightLabel)] },
          collapseUnchanged,
          diffConfig,
        })
        chunks = merge.chunks
        docA = merge.a.state.doc
        docB = merge.b.state.doc
      } else {
        unified = new EditorView({
          parent: container.current,
          doc: after,
          extensions: [
            ...extensions,
            attributes(`${leftLabel} → ${rightLabel}`),
            EditorView.scrollHandler.of((view, range, options) => {
              if (options.y !== 'start') return false
              // Deleted text is a block widget before the surviving line. Include
              // that block when navigating, rather than scrolling past the deletion.
              view.scrollDOM.scrollTop +=
                view.documentTop +
                view.lineBlockAt(range.head).top -
                view.scrollDOM.getBoundingClientRect().top -
                options.yMargin
              return true
            }),
            unifiedMergeView({
              original: before,
              mergeControls: false,
              syntaxHighlightDeletions: false,
              collapseUnchanged,
              diffConfig,
            }),
          ],
        })
        chunks = getChunks(unified.state)?.chunks ?? []
        docA = getOriginalDoc(unified.state)
        docB = unified.state.doc
      }
      setSummary({
        ready: true,
        total: chunks.length,
        added: chunks.reduce((sum, c) => sum + changedLines(docB, c.fromB, c.toB), 0),
        removed: chunks.reduce((sum, c) => sum + changedLines(docA, c.fromA, c.toA), 0),
        coarse: coarse || changes !== undefined || chunks.some((chunk) => !chunk.precise),
      })
      const jump = (index: number) => {
        if (!chunks.length) return
        active.current = (index + chunks.length) % chunks.length
        const chunk = chunks[active.current]
        if (merge) {
          const left = Math.min(chunk.fromA, merge.a.state.doc.length)
          const right = Math.min(chunk.fromB, merge.b.state.doc.length)
          // Scroll the side with changed text, so pure deletions don't land after
          // the alignment spacer. Both panes share the same scroll container.
          const scrollLeft = chunk.fromA !== chunk.toA
          merge.a.dispatch({
            selection: { anchor: left },
            effects: scrollLeft ? EditorView.scrollIntoView(left, { y: 'start', yMargin: 12 }) : [],
          })
          merge.b.dispatch({
            selection: { anchor: right },
            effects: scrollLeft
              ? []
              : EditorView.scrollIntoView(right, { y: 'start', yMargin: 12 }),
          })
        } else if (unified) {
          const pos = Math.min(chunk.fromB, unified.state.doc.length)
          unified.dispatch({
            selection: { anchor: pos },
            effects: EditorView.scrollIntoView(pos, { y: 'start', yMargin: 12 }),
          })
        }
        setCurrent(active.current + 1)
      }
      navigate.current = (direction) => jump(active.current + direction)
      if (chunks.length) jump(Math.max(0, Math.min(active.current, chunks.length - 1)))
    }

    if (cached.current) {
      mount(cached.current.changes, cached.current.coarse)
    } else if (before !== after && Math.max(before.length, after.length) > 2 * 1024 * 1024) {
      const fallback = () => mount([new Change(0, before.length, 0, after.length)], true)
      try {
        worker = new Worker(new URL('./historyDiff.worker.ts', import.meta.url), { type: 'module' })
        worker.onmessage = ({ data }: MessageEvent<{ changes?: Change[] }>) =>
          data.changes
            ? mount(data.changes.map((c) => new Change(c.fromA, c.toA, c.fromB, c.toB)))
            : fallback()
        worker.onerror = fallback
        timer = setTimeout(fallback, 2500)
        worker.postMessage({ before, after })
      } catch {
        fallback()
      }
    } else mount()
    return () => {
      disposed = true
      navigate.current = () => {}
      clearTimeout(timer)
      worker?.terminate()
      merge?.destroy()
      unified?.destroy()
    }
  }, [before, after, mode, fullContext, leftLabel, rightLabel, unchangedPhrase])

  return (
    <TooltipProvider>
      <div
        className='mf-history-diff flex min-h-0 flex-1 flex-col bg-background'
        onKeyDown={(event) => {
          if (event.key === 'F7' && !event.altKey && !event.metaKey && !event.ctrlKey) {
            event.preventDefault()
            event.stopPropagation()
            navigate.current(event.shiftKey ? -1 : 1)
          }
        }}
      >
        <div className='flex min-h-10 shrink-0 flex-wrap items-center justify-between gap-x-3 border-b border-border px-3 py-1'>
          <div
            className='flex min-w-0 items-center gap-3 text-ui-caption tabular-nums'
            role='status'
          >
            {!summary.ready ? (
              t('history.loading')
            ) : summary.total === 0 ? (
              t('history.no_changes')
            ) : (
              <>
                <span
                  className='text-success'
                  aria-label={t('history.added_lines', { count: summary.added })}
                >
                  +{summary.added}
                </span>
                <span
                  className='text-destructive'
                  aria-label={t('history.removed_lines', { count: summary.removed })}
                >
                  −{summary.removed}
                </span>
                <span className='text-muted-foreground'>
                  {t('history.change_position', { current, total: summary.total })}
                </span>
              </>
            )}
          </div>
          <div className='flex items-center gap-0.5'>
            <DiffButton
              label={t('history.split')}
              aria-pressed={mode === 'split'}
              onClick={() => setMode('split')}
              disabled={!summary.ready}
            >
              <Columns2Icon className='size-3.5' aria-hidden='true' />
            </DiffButton>
            <DiffButton
              label={t('history.unified')}
              aria-pressed={mode === 'unified'}
              onClick={() => setMode('unified')}
              disabled={!summary.ready}
            >
              <Rows2Icon className='size-3.5' aria-hidden='true' />
            </DiffButton>
            <span className='mx-1 h-3.5 w-px bg-border' aria-hidden='true' />
            <DiffButton
              label={t('history.full_context')}
              aria-pressed={fullContext}
              onClick={() => setFullContext(!fullContext)}
              disabled={!summary.ready}
            >
              <UnfoldVerticalIcon className='size-3.5' aria-hidden='true' />
            </DiffButton>
            <span className='mx-1 h-3.5 w-px bg-border' aria-hidden='true' />
            <DiffButton
              label={`${t('history.previous_change')} (Shift+F7)`}
              onClick={() => navigate.current(-1)}
              disabled={!summary.ready || !summary.total}
            >
              <ArrowUpIcon className='size-3.5' aria-hidden='true' />
            </DiffButton>
            <DiffButton
              label={`${t('history.next_change')} (F7)`}
              onClick={() => navigate.current(1)}
              disabled={!summary.ready || !summary.total}
            >
              <ArrowDownIcon className='size-3.5' aria-hidden='true' />
            </DiffButton>
          </div>
        </div>
        <div
          className={`grid shrink-0 border-b border-border bg-muted/30 text-ui-caption text-muted-foreground ${mode === 'split' ? 'grid-cols-2' : 'grid-cols-1'}`}
        >
          {mode === 'split' ? (
            <>
              <div className='truncate border-r border-border px-3 py-1.5' title={leftLabel}>
                <span className='mr-2 text-destructive' aria-hidden='true'>
                  −
                </span>
                {leftLabel}
              </div>
              <div className='truncate px-3 py-1.5' title={rightLabel}>
                <span className='mr-2 text-success' aria-hidden='true'>
                  +
                </span>
                {rightLabel}
              </div>
            </>
          ) : (
            <div className='truncate px-3 py-1.5' title={`${leftLabel} → ${rightLabel}`}>
              {leftLabel} <span aria-hidden='true'>→</span> {rightLabel}
            </div>
          )}
        </div>
        {summary.coarse ? (
          <p className='border-b border-border px-3 py-1.5 text-ui-caption text-muted-foreground'>
            {t('history.coarse')}
          </p>
        ) : null}
        <div ref={container} className='mf-history-diff-editor min-h-0 flex-1 overflow-hidden' />
      </div>
    </TooltipProvider>
  )
}
