import { DocumentTitle } from './DocumentTitle'
import { isSingleDocumentLayout } from '../EditorArea/documentLayout'
import { useGlobalOSInfo } from '@/hooks'
import { useTranslation } from '@/i18n'
import { cn } from '@/lib/cn'
import { useEditorStore } from '@/stores'
import { WorkspaceActions } from '../WorkspaceActions'
import { AppMenuButton } from './AppMenuButton'
import { WindowControls } from './WindowControls'
import useResizeObserver from 'use-resize-observer'

export default function TitleBar() {
  const { osType } = useGlobalOSInfo()
  const { t } = useTranslation()
  const singleDocument = useEditorStore((state) => isSingleDocumentLayout(state.folderData?.[0]?.path, state.editorLayout))
  const isMacOS = osType === 'macos'
  const isWindows = osType === 'windows'
  const { ref: leadingRef, width: leadingWidth } = useResizeObserver<HTMLDivElement>({
    box: 'border-box',
    round: Math.ceil,
  })
  const { ref: trailingRef, width: trailingWidth } = useResizeObserver<HTMLDivElement>({
    box: 'border-box',
    round: Math.ceil,
  })
  const titleInset =
    leadingWidth === undefined || trailingWidth === undefined
      ? undefined
      : Math.max(leadingWidth, trailingWidth) + 8

  // Linux keeps its native window decorations until frameless resizing and
  // window controls can be validated across the supported window managers.
  if (osType === 'linux') return null

  return (
    <header
      aria-label={t('titleBar.label')}
      className='relative z-10 flex h-[var(--mf-ui-title-bar-height)] w-full shrink-0 select-none items-center border-b border-titlebar-border bg-surface-titlebar text-content-primary'
      data-mf-platform={osType}
      data-slot='title-bar'
      data-tauri-drag-region
    >
      <div
        className={cn('flex h-full shrink-0 items-center', isMacOS ? 'pl-[76px]' : 'pl-2')}
        data-tauri-drag-region
        ref={leadingRef}
      >
        <WorkspaceActions />
      </div>
      <div
        className='absolute inset-y-0 left-1/2 flex w-max min-w-0 -translate-x-1/2 items-center justify-center overflow-hidden'
        data-slot='title-bar-document'
        data-tauri-drag-region
        style={{
          maxWidth:
            titleInset === undefined ? 0 : `max(0px, calc(100% - ${titleInset * 2}px))`,
        }}
      >
        {singleDocument ? <DocumentTitle /> : null}
      </div>
      <div
        className={cn('ml-auto flex h-full shrink-0 items-center', !isWindows && 'pr-1')}
        ref={trailingRef}
      >
        <AppMenuButton />
        {isWindows ? <WindowControls /> : null}
      </div>
    </header>
  )
}
