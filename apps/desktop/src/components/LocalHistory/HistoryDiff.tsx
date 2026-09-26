import { useEffect, useRef, useState } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { Change, MergeView, getChunks } from '@codemirror/merge'
import { useTranslation } from '@/i18n'

export default function HistoryDiff({ before, after }: { before: string; after: string }) {
  const container = useRef<HTMLDivElement>(null)
  const [imprecise, setImprecise] = useState(false)
  const { t } = useTranslation()
  useEffect(() => {
    if (!container.current) return
    const extensions = [
      EditorState.readOnly.of(true),
      EditorView.editable.of(false),
      EditorView.lineWrapping,
      EditorView.theme({
        '&': {
          height: '100%',
          backgroundColor: 'transparent',
          color: 'var(--mf-foreground)',
          fontSize: 'var(--mf-theme-font-source-size, 15px)',
        },
        '.cm-scroller': {
          overflow: 'auto',
          fontFamily: 'var(--mf-theme-font-code-family, monospace)',
          lineHeight: 'var(--mf-theme-font-source-line-height, 1.6)',
        },
        '.cm-content': { padding: '8px 0' },
        '.cm-line': { padding: '0 8px' },
        '.cm-gutters': { backgroundColor: 'transparent', color: 'var(--mf-muted-foreground)' },
        '.cm-deletedText, .cm-deletedLine': {
          backgroundColor: 'color-mix(in srgb, var(--mf-destructive) 15%, transparent)',
        },
        '.cm-insertedText, .cm-insertedLine': {
          backgroundColor: 'color-mix(in srgb, var(--mf-primary) 15%, transparent)',
        },
      }),
    ]
    let view: MergeView | undefined
    let worker: Worker | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    let disposed = false
    const mount = (changes?: Change[]) => {
      if (disposed || !container.current || view) return
      worker?.terminate()
      clearTimeout(timer)
      view = new MergeView({
        parent: container.current,
        a: { doc: before, extensions },
        b: { doc: after, extensions },
        collapseUnchanged: { margin: 3, minSize: 6 },
        diffConfig: {
          scanLimit: 1000,
          timeout: 100,
          ...(changes ? { override: () => changes } : {}),
        },
      })
      setImprecise(
        Boolean(changes) || !!getChunks(view.a.state)?.chunks.some((chunk) => !chunk.precise),
      )
    }
    if (Math.max(before.length, after.length) > 2 * 1024 * 1024) {
      const fallback = () => mount([new Change(0, before.length, 0, after.length)])
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
      clearTimeout(timer)
      worker?.terminate()
      view?.destroy()
    }
  }, [before, after])
  return (
    <>
      {imprecise ? <p className='text-ui-caption text-muted-foreground'>{t('history.coarse')}</p> : null}
      <div ref={container} className='min-h-0 flex-1 overflow-auto [&_.cm-mergeView]:h-full' />
    </>
  )
}
