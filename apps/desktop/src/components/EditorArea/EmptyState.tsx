import { useOpen } from '@/hooks'
import { addNewMarkdownFileEdit } from '@/services/editor-file'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

export const EmptyState = memo(() => {
  const { t } = useTranslation()
  const { openFolderDialog, openFile } = useOpen()

  const startNavItems = [
    {
      name: t('file.openDir'),
      action: openFolderDialog,
    },
    {
      name: t('file.openFile'),
      action: openFile,
    },
    {
      name: t('action.create_file'),
      action: () =>
        addNewMarkdownFileEdit({
          fileName: 'new-file.md',
          content: '',
        }),
    },
  ]

  return (
    <Container className='w-full h-full'>
      <div>
        <div className='nav-list'>
          {startNavItems.map((item) => (
            <ActionButton key={item.name} onClick={item.action}>
              {item.name}
            </ActionButton>
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
    min-width: 180px;

    &__item {
      width: 100%;
      color: ${({ theme }) => theme.accentColor};
      cursor: pointer;
    }
  }
`

const ActionButton = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  background-color: ${(props) => props.theme.bgColorSecondary};
  color: ${(props) => props.theme.primaryFontColor};

  &:hover {
    background-color: ${(props) => props.theme.hoverColor};
  }
`
