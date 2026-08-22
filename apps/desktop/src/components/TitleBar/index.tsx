import { APP_NAME } from '@/constants'
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
  const hasWorkspace = useEditorStore((state) => Boolean(state.folderData?.[0]?.path))
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
        {hasWorkspace ? null : (
          <>
            <span className='px-2 text-ui-control font-medium' data-tauri-drag-region>
              {APP_NAME}
            </span>
            <span
              aria-hidden='true'
              className='mx-1 h-3.5 w-px shrink-0 bg-border'
              data-tauri-drag-region
            />
          </>
        )}
        <WorkspaceActions />
      </div>
      <div className='min-w-12 flex-1 self-stretch' data-tauri-drag-region />
      <div className={cn('flex h-full shrink-0 items-center', !isWindows && 'pr-1')}>
        <AppMenuButton />
        {isWindows ? <WindowControls /> : null}
      </div>
    </header>
  )
}
