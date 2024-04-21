import { addNewMarkdownFileEdit } from '@/services/editor-file'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

export const EmptyState = memo(() => {
  const { t } = useTranslation()

  return (
    <Container className='w-full h-full'>
      <div>
        <p className='text-4xl font-bold text-gray-400'>{t('file.emptyOpened')}</p>
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
