import { lazy, Suspense } from 'react'

const LazyProsemirrorDevTools = lazy(() =>
  import('@rme-sdk/sdk/dev').then((module) => ({
    default: module.ProsemirrorDevTools,
  })),
)

export function EditorDevTools() {
  return (
    <Suspense fallback={null}>
      <LazyProsemirrorDevTools />
    </Suspense>
  )
}
