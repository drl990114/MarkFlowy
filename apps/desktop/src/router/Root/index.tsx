import { useEffect } from 'react'
import { Container } from './styles'
import { AppInfoDialog, SideBar } from '@/components'
import EditorArea from '@/components/EditorArea'
import TableDialog from '@/components/EditorArea/editorToolBar/TableDialog'
import { useCommandInit } from '@/hooks/useCommandInit'
import { BookMarkDialog } from '@/extensions/bookmarks/BookMarkDialog'
import useBookMarksStore from '@/extensions/bookmarks/useBookMarksStore'
import { PageLayout } from '@/components/Layout'
import { SettingDialog } from '../Setting/component/SettingDialog'
import { appInfoStoreSetup } from '@/services/app-info'
import StatusBar from '@/components/StatusBar'

function Root() {
  const { getBookMarkList } = useBookMarksStore()

  useCommandInit()

  useEffect(() => {
    appInfoStoreSetup()
  }, [])

  useEffect(() => {
    getBookMarkList()
  }, [getBookMarkList])

  return (
    <PageLayout>
      {/* <TitleBar /> */}
      <Container>
        <SideBar />
        <EditorArea />
        <AppInfoDialog />
        <TableDialog />
        <BookMarkDialog />
        <SettingDialog />
      </Container>
      <StatusBar />
    </PageLayout>
  )
}

export default Root
