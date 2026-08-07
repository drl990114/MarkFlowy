import type { EditorView } from '@rme-sdk/sdk/pm/view'
import type { LivePreviewBlockBehavior } from './live-preview-types'

export interface LivePreviewBehaviorTarget {
  setBehavior: (behavior: LivePreviewBlockBehavior) => void
  getPosition: () => number
  editSource: () => void
}

const behaviorByEditor = new WeakMap<EditorView, LivePreviewBlockBehavior>()
const targetsByEditor = new WeakMap<EditorView, Set<LivePreviewBehaviorTarget>>()

export function registerLivePreviewBehaviorTarget(
  view: EditorView,
  target: LivePreviewBehaviorTarget,
  initialBehavior: LivePreviewBlockBehavior,
): LivePreviewBlockBehavior {
  let targets = targetsByEditor.get(view)
  if (!targets) {
    targets = new Set()
    targetsByEditor.set(view, targets)
  }
  targets.add(target)

  const currentBehavior = behaviorByEditor.get(view)
  if (currentBehavior) {
    return currentBehavior
  }

  behaviorByEditor.set(view, initialBehavior)
  return initialBehavior
}

export function unregisterLivePreviewBehaviorTarget(
  view: EditorView,
  target: LivePreviewBehaviorTarget,
): void {
  targetsByEditor.get(view)?.delete(target)
}

export function updateLivePreviewBlockBehavior(
  view: EditorView,
  behavior: LivePreviewBlockBehavior,
): void {
  behaviorByEditor.set(view, behavior)
  targetsByEditor.get(view)?.forEach((target) => target.setBehavior(behavior))
}

export function editLivePreviewSourceAt(view: EditorView, position: number): boolean {
  const targets = targetsByEditor.get(view)
  if (!targets) {
    return false
  }

  for (const target of targets) {
    if (target.getPosition() === position) {
      target.editSource()
      return true
    }
  }

  return false
}
