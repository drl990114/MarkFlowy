import { DocumentTitle } from './DocumentTitle'
import { isSingleDocumentLayout } from '../EditorArea/documentLayout'
import { useGlobalOSInfo } from '@/hooks'
import { useTranslation } from '@/i18n'
import { cn } from '@/lib/cn'
import { useEditorStore } from '@/stores'
import { WorkspaceActions } from '../WorkspaceActions'
import { AppMenuButton } from './AppMenuButton'
import { WindowControls } from './WindowControls'

export default function TitleBar() {
  const { osType } = useGlobalOSInfo()
  const { t } = useTranslation()
  const singleDocument = useEditorStore((state) => isSingleDocumentLayout(state.folderData?.[0]?.path, state.editorLayout))
  const isMacOS = osType === 'macos'
  const isWindows = osType === 'windows'

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
      >
        <WorkspaceActions />
      </div>
      <div className='flex min-w-12 flex-1 items-center justify-center overflow-hidden px-4' data-tauri-drag-region>
        {singleDocument ? <DocumentTitle /> : null}
      </div>
      <div className={cn('flex h-full shrink-0 items-center', !isWindows && 'pr-1')}>
        <AppMenuButton />
        {isWindows ? <WindowControls /> : null}
      </div>
    </header>
  )
}
