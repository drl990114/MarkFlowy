import type { ResumePoint, ResumeSelection } from '@/stores/editorResumeStore'
import type { CapricornRuntimeSession } from './capricornRuntimeAdapter'

type Point = { key: string; offset?: number; edge?: 'before' | 'after' }
interface ResumeController {
  value: {
    selection: { anchor: Point; focus: Point } | null
    document: {
      getPath: (key: string) => number[] | null
      getNodeByPath: (path: number[]) => { key: string; text: string; isText: () => boolean } | null
    }
  }
  withoutSaving: (operation: () => void) => void
  command: (name: string, selection: { anchor: Point; focus: Point }) => { flush: () => void }
  subscribe: (
    selector: (state: { value$?: ResumeController['value'] }) => unknown,
    listener: () => void,
    fireImmediately: boolean,
  ) => (() => void) | { unsubscribe: () => void }
}

// Use the same isolated Controller.query callback bridge as capricornHeadingViewport.
// Model paths survive new session keys; no DOM selection or full Markdown export is needed.
function query<T>(session: CapricornRuntimeSession, read: (controller: ResumeController) => T) {
  const run = session.query as unknown as
    | ((read: (controller: ResumeController) => T) => T)
    | undefined
  return run?.call(session, read)
}

export function createCapricornResumeApi(session: CapricornRuntimeSession) {
  return {
    capture(): ResumeSelection | undefined {
      return query(session, ({ value }) => {
        const selection = value.selection
        if (!selection) return undefined
        const convert = (point: Point): ResumePoint | undefined => {
          const path = value.document.getPath(point.key)
          if (!path) return undefined
          return typeof point.offset === 'number'
            ? { path, offset: point.offset }
            : { path, edge: point.edge }
        }
        const anchor = convert(selection.anchor)
        const focus = convert(selection.focus)
        return anchor && focus ? { kind: 'capricorn' as const, anchor, focus } : undefined
      })
    },
    restore(selection: ResumeSelection): boolean {
      if (selection.kind !== 'capricorn') return false
      return (
        query(session, (controller) => {
          const convert = (point: ResumePoint): Point | undefined => {
            const node = controller.value.document.getNodeByPath(point.path)
            if (!node) return undefined
            if (typeof point.offset === 'number') {
              if (!node.isText()) return undefined
              return { key: node.key, offset: Math.min(point.offset, node.text.length) }
            }
            return point.edge ? { key: node.key, edge: point.edge } : undefined
          }
          const anchor = convert(selection.anchor)
          const focus = convert(selection.focus)
          if (!anchor || !focus) return false
          controller.withoutSaving(() => controller.command('select', { anchor, focus }).flush())
          return true
        }) ?? false
      )
    },
    subscribe(listener: () => void): () => void {
      return (
        query(session, (controller) => {
          const unsubscribe = controller.subscribe(
            (state) => state.value$?.selection,
            listener,
            false,
          )
          return () =>
            typeof unsubscribe === 'function' ? unsubscribe() : unsubscribe.unsubscribe()
        }) ?? (() => {})
      )
    },
  }
}
