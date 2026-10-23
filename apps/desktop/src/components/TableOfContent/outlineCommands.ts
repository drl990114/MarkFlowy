import { commandRegistry } from '@/commands'
import useLayoutStore from '@/stores/useLayoutStore'

export const OUTLINE_COLLAPSE_ALL = 'app_outlineCollapseAll'
export const OUTLINE_EXPAND_ALL = 'app_outlineExpandAll'

interface OutlineController {
  isCurrent: () => boolean
  collapseAll: () => void
  expandAll: () => void
}

let currentController: OutlineController | undefined

export function isOutlineCommand(commandId: string) {
  return commandId === OUTLINE_COLLAPSE_ALL || commandId === OUTLINE_EXPAND_ALL
}

export function isOutlineCommandAvailable(commandId?: string): boolean {
  if (commandId !== undefined && !isOutlineCommand(commandId)) return false
  const layout = useLayoutStore.getState()
  return !layout.zenModeActive &&
    [layout.leftBar, layout.rightBar].some((dock) => dock.visible && dock.activePanelId === 'toc') &&
    Boolean(currentController?.isCurrent())
}

export function registerOutlineCommands(controller: OutlineController): () => void {
  currentController = controller
  const commands = [
    commandRegistry.registerCommand({
      id: OUTLINE_COLLAPSE_ALL,
      handler: () => {
        if (!isOutlineCommandAvailable()) return false
        controller.collapseAll()
        return true
      },
    }),
    commandRegistry.registerCommand({
      id: OUTLINE_EXPAND_ALL,
      handler: () => {
        if (!isOutlineCommandAvailable()) return false
        controller.expandAll()
        return true
      },
    }),
  ]
  return () => {
    if (currentController !== controller) return
    currentController = undefined
    commands.forEach((command) => command.dispose())
  }
}
