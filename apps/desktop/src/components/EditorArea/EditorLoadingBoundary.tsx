import {
  createContext,
  Suspense,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentProps,
  type ReactNode,
} from 'react'
import { cn } from '@/lib/cn'
import { EditorLoadingProgress } from './EditorLoadingProgress'

function createLoadingState(initialSource: symbol, pending: boolean) {
  const sources = new Set<symbol>(pending ? [initialSource] : [])
  const listeners = new Set<() => void>()
  let snapshot = pending
  const publish = (next: boolean) => {
    if (snapshot === next) return
    snapshot = next
    listeners.forEach((listener) => listener())
  }
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    setPending: (source: symbol, next: boolean, deferEmpty = true) => {
      if (next) {
        sources.add(source)
        publish(true)
      } else {
        sources.delete(source)
        // A lazy fallback and its content exchange ownership in one commit.
        // Let every source report before ending the shared loading operation.
        if (!sources.size) {
          if (deferEmpty) queueMicrotask(() => { if (!sources.size) publish(false) })
          else publish(false)
        }
      }
    },
  }
}

const EditorLoadingContext = createContext<ReturnType<typeof createLoadingState> | null>(null)

/** Contribute one independently owned async operation to the enclosing editor. */
export function useEditorLoading(pending: boolean) {
  const owner = useContext(EditorLoadingContext)
  const source = useRef(Symbol('editor-loading'))
  useLayoutEffect(() => {
    if (!owner || !pending) return
    const token = source.current
    owner.setPending(token, true)
    return () => owner.setPending(token, false)
  }, [owner, pending])
}

function LoadingFallback() {
  useEditorLoading(true)
  return null
}

export interface EditorLoadingBoundaryProps extends ComponentProps<'div'> {
  pending?: boolean
  visible?: boolean
}

/** Keep async feedback and suspension inside one editor pane. */
export function EditorLoadingBoundary({
  children,
  className,
  pending = false,
  visible = true,
  ...props
}: EditorLoadingBoundaryProps) {
  const source = useRef(Symbol('editor-opening'))
  const [owner] = useState(() => createLoadingState(source.current, pending))
  const loading = useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getSnapshot)
  // Descendants report first during layout; this final source can settle now.
  useLayoutEffect(() => owner.setPending(source.current, pending, false), [owner, pending])

  return (
    <EditorLoadingContext value={owner}>
      <div
        {...props}
        className={cn('relative', className)}
        data-slot='editor-loading-boundary'
        aria-busy={loading && visible}
      >
        <Suspense fallback={<LoadingFallback />}>{children}</Suspense>
        <EditorLoadingProgress pending={loading} visible={visible} />
      </div>
    </EditorLoadingContext>
  )
}

/** Share a pane's loading feedback, with a local owner for standalone previews. */
export function EditorLoadingSuspense({ children }: { children: ReactNode }) {
  const owner = useContext(EditorLoadingContext)
  return owner ? (
    <Suspense fallback={<LoadingFallback />}>{children}</Suspense>
  ) : (
    <EditorLoadingBoundary className='h-full w-full'>{children}</EditorLoadingBoundary>
  )
}
