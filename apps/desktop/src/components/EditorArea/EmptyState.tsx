import { useOpen } from '@/hooks'
import { addNewMarkdownFileEdit } from '@/services/editor-file'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

export const EmptyState = memo(() => {
  const { t } = useTranslation()
  const { openFolderDialog } = useOpen()

  const startNavItems = [
    {
      name: t('action.create_file'),
      action: () =>
        addNewMarkdownFileEdit({
          fileName: 'new-file.md',
          content: '',
        }),
    },
    {
      name:  t('file.openDir'),
      action: openFolderDialog,
    },
  ]

  return (
    <Container className='w-full h-full'>
      <div>
        <p className='nav-title'>{t('file.emptyOpened')}</p>
        <div className='nav-list'>
          {startNavItems.map((item) => (
            <div className='nav-list__item' key={item.name} onClick={item.action}>
              {item.name}
            </div>
          ))}
        </div>
      </div>
    </Container>
  )
})

const Container = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 30px;
  font-size: 0.8rem;
  box-sizing: border-box;

  .nav-title {
    font-size: 1.2rem;
  }

  .nav-list {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-width: 160px;

    &__item {
      width: 100%;
      color: ${({ theme }) => theme.accentColor};
      cursor: pointer;
    }
  }
`
