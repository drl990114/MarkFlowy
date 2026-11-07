import { commandRegistry } from './CommandRegistry'
import {
  captureEditorCommandTarget,
  releaseEditorCommandTarget,
} from '@/extensions/command-palette/editorCommandTarget'
import { executeZoomCommand, ZOOM_COMMANDS } from './zoomCommands'

export const INSERT_BLOCK_COMMANDS = ['editor_insertCodeBlock', 'editor_insertMathBlock'] as const

export function registerCommonEditorCommands() {
  const registrations = [
    ...INSERT_BLOCK_COMMANDS.map((id) => commandRegistry.registerCommand({
      id,
      handler: async () => {
        const target = captureEditorCommandTarget()
        try {
          const { executeEditorPaletteCommand } = await import('@/extensions/command-palette/editorCommands')
          return await executeEditorPaletteCommand(target, id)
        } finally {
          releaseEditorCommandTarget(target)
        }
      },
    })),
    ...ZOOM_COMMANDS.map((id) => commandRegistry.registerCommand({
      id,
      handler: () => executeZoomCommand(id),
    })),
  ]
  return () => registrations.forEach((registration) => registration.dispose())
}
