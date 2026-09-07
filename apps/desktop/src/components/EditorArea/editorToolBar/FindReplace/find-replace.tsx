import { commandRegistry } from '@/commands'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { useTranslation } from '@/i18n'
import { openDocumentSearch, useEditorSearchStore } from '../../editorSearchStore'
import { FindReplaceControls } from './find-replace-component'
import { useEditorSearchController } from './use-editor-search'

export function FindReplace() {
  const controller = useEditorSearchController()
  const ref = useRef<HTMLDivElement>(null)
  const { t } = useTranslation()
  useEffect(() => {
    const open = commandRegistry.registerCommand({
      id: 'app_findReplaceEditor',
      handler: openDocumentSearch,
    })
    const close = commandRegistry.registerCommand({
      id: 'app_stopFindEditor',
      handler: controller.stopFind,
    })
    return () => {
      open.dispose()
      close.dispose()
    }
  }, [controller.stopFind])
  useLayoutEffect(() => {
    if (
      controller.open &&
      controller.available &&
      useEditorSearchStore.getState().focusedRevision !== controller.focusRevision
    ) {
      const input = ref.current?.querySelector('input')
      if (!input) return
      // Moving the bar between panes must not steal focus from the clicked
      // editor. Only consume an explicit open/refocus request, once ready.
      input.focus({ preventScroll: true })
      input.select()
      useEditorSearchStore.setState({ focusedRevision: controller.focusRevision })
    }
  }, [controller.open, controller.available, controller.focusRevision])

  if (!controller.open && !controller.error) return null
  return (
    <div ref={ref} data-slot='editor-find' className='shrink-0 bg-background p-2 text-foreground'>
      {controller.open ? <FindReplaceControls controller={controller} /> : null}
      {controller.error ? (
        <div role='status' className='mt-1 text-xs text-muted-foreground'>
          {t(`find_replace.navigation_${controller.error}`)}
        </div>
      ) : null}
    </div>
  )
}
