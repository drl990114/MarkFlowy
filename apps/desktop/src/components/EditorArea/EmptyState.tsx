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
      <div className='empty-state-content'>
        <div className='app-title'>
          <p>MarkFlowy</p>
        </div>

        <div className='nav-section'>
          <div className='nav-btn-list'>
            {startNavItems.map((item) => (
              <ActionButton key={item.name} onClick={item.action}>
                {item.name}
              </ActionButton>
            ))}
          </div>
        </div>
      </div>
    </Container>
  )
})

const Container = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 30px 40px;
  box-sizing: border-box;
  background-color: ${({ theme }) => theme.bgColor};
  color: ${({ theme }) => theme.primaryFontColor};

  .empty-state-content {
    width: 100%;
    max-width: 350px;
    padding: 20px;
    border-radius: 8px;
    background-color: ${({ theme }) => theme.bgColor};
    box-shadow: '0 1px 3px rgba(0, 0, 0, 0.05)';
  }

  .app-title {
    margin-bottom: 16px;
    font-size: 1.5rem;
    font-weight: 700;
    letter-spacing: -0.5px;
    color: ${({ theme }) => theme.primaryFontColor};
  }

  .nav-section {
    margin-bottom: 24px;

    &:last-child {
      margin-bottom: 0;
    }
  }

  .nav-btn-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
    flex-wrap: wrap;
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
