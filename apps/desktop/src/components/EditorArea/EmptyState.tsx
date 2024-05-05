import { useOpen } from '@/hooks'
import { addNewMarkdownFileEdit } from '@/services/editor-file'
import { useEditorStore } from '@/stores'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

export const EmptyState = memo(() => {
  const { folderData } = useEditorStore()
  const { t } = useTranslation()
  const { openFolderDialog } = useOpen()

  return (
    <Container className='w-full h-full'>
      <div>
        <p className='text-4xl font-bold text-gray-400'>{t('file.emptyOpened')}</p>
        {folderData?.length ? (
          <a
            onClick={() =>
              addNewMarkdownFileEdit({
                fileName: 'new-file.md',
                content: '',
              })
            }
          >
            {t('action.create_file')}
          </a>
        ) : (
          <a
            onClick={openFolderDialog}
          >
           {t('file.openDir')}
          </a>
        )}
      </div>
    </Container>
  )
})

const Container = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;

  a {
    color: ${({ theme }) => theme.accentColor};
    cursor: pointer;
  }
`
