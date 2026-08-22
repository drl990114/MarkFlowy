import { DockSwitcher } from '../SideBar/DockSwitcher'
import { TaskList } from '../TaskList/TaskList'
import { WorkspaceActions } from '../WorkspaceActions'
import { useGlobalOSInfo } from '@/hooks'
import { useEditorStore } from '@/stores'
import useEditorCounterStore from '@/stores/useEditorCounterStore'
import { EditorCount } from './EditorCount'
import { CenterMenu } from './SettingBtn'
import { StatusOverflow } from './StatusOverflow'
import { Container, LeftContainer, RightContainer, StatusBarSeparator } from './styled'
import { ZenModeButton } from './ZenModeButton'
import useLayoutStore from '@/stores/useLayoutStore'
import { useTranslation } from '@/i18n'
import { handleStatusBarKeyDown } from './keyboardNavigation'

export default function StatusBar() {
  const { osType } = useGlobalOSInfo()
  const compact = useLayoutStore((state) => state.viewportMode === 'compact')
  const activeEditorId = useEditorStore((state) => state.activeId)
  const hasEditorCount = useEditorCounterStore((state) =>
    Boolean(activeEditorId && state.editorCounterMap[activeEditorId]),
  )
  const { t } = useTranslation()

  return (
    <Container aria-label={t('statusBar.label')} onKeyDown={handleStatusBarKeyDown} role='toolbar'>
      <LeftContainer>
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
      </LeftContainer>
      <RightContainer>
        <TaskList />
        {compact ? null : <EditorCount />}
        <ZenModeButton />
        <StatusBarSeparator />
        <DockSwitcher side='right' />
      </RightContainer>
    </Container>
  )
}
