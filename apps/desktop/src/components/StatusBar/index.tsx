import { DockSwitcher } from '../SideBar/DockSwitcher'
import { useDockDragStore } from '../SideBar/dockDragData'
import { useDockDropTarget } from '../SideBar/useDockDropTarget'
import { WorkspaceActions } from '../WorkspaceActions'
import { useGlobalOSInfo } from '@/hooks'
import { useEditorStore } from '@/stores'
import useEditorCounterStore from '@/stores/useEditorCounterStore'
import { EditorCount } from './EditorCount'
import { CenterMenu } from './SettingBtn'
import { StatusOverflow } from './StatusOverflow'
import { Container, LeftContainer, RightContainer, StatusBarSeparator } from './styled'
import { ZenModeButton } from './ZenModeButton'
import { useMedia } from 'react-use'
import { useTranslation } from '@/i18n'
import { handleStatusBarKeyDown } from './keyboardNavigation'

export default function StatusBar() {
  const { osType } = useGlobalOSInfo()
  const compact = useMedia('(max-width: 719px)', false)
  const activeEditorId = useEditorStore((state) => state.activeId)
  const hasEditorCount = useEditorCounterStore((state) =>
    Boolean(activeEditorId && state.editorCounterMap[activeEditorId]),
  )
  const { t } = useTranslation()
  const draggingDock = useDockDragStore((state) => state.panelId !== null)
  const leftDrop = useDockDropTarget('left')
  const rightDrop = useDockDropTarget('right')

  return (
    <Container
      aria-label={t('statusBar.label')}
      data-mf-dock-dragging={draggingDock ? '' : undefined}
      onKeyDown={handleStatusBarKeyDown}
      role='toolbar'
    >
      <LeftContainer
        data-mf-dock-drop-side='left'
        data-drop-over={draggingDock && leftDrop.over ? '' : undefined}
        {...leftDrop.handlers}
      >
        {osType === 'linux' ? (
          <>
            <CenterMenu />
            <WorkspaceActions location='statusbar' />
          </>
        ) : null}
        <DockSwitcher side='left' />
        {compact && hasEditorCount ? (
          <>
            <StatusBarSeparator />
            <StatusOverflow />
          </>
        ) : null}
        {draggingDock ? <span className='mf-dock-drop-hint'>{t('sidebar.move_left')}</span> : null}
      </LeftContainer>
      <RightContainer
        data-mf-dock-drop-side='right'
        data-drop-over={draggingDock && rightDrop.over ? '' : undefined}
        {...rightDrop.handlers}
      >
        {compact ? null : <EditorCount />}
        <ZenModeButton />
        <StatusBarSeparator />
        <DockSwitcher side='right' />
        {draggingDock ? <span className='mf-dock-drop-hint'>{t('sidebar.move_right')}</span> : null}
      </RightContainer>
    </Container>
  )
}
