import { useOpen } from '@/hooks'
import { addNewMarkdownFileEdit } from '@/services/editor-file'
import { memo } from 'react'
import { useTranslation } from '@/i18n'
import styled from 'styled-components'

export const EmptyState = memo(() => {
  const { t } = useTranslation()
  const { openFolderDialog, openFile } = useOpen()

  const startNavItems = [
    {
      name: t('file.openDir'),
      icon: 'ri-folder-open-line',
      action: openFolderDialog,
    },
    {
      name: t('file.openFile'),
      icon: 'ri-file-text-line',
      action: openFile,
    },
    {
      name: t('action.create_file'),
      icon: 'ri-file-add-line',
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
        <div className='nav-section'>
          <div className='nav-btn-list'>
            {startNavItems.map((item) => (
              <ActionButton key={item.name} onClick={item.action}>
                <span className='action-label'>
                  <i className={item.icon} aria-hidden='true' />
                  <span>{item.name}</span>
                </span>
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
  padding: 32px 40px;
  box-sizing: border-box;
  background-color: ${({ theme }) => theme.bgColor};
  color: ${({ theme }) => theme.primaryFontColor};

  .empty-state-content {
    width: 100%;
    max-width: 280px;
  }

  .nav-section {
    margin-bottom: 0;

    &:last-child {
      margin-bottom: 0;
    }
  }

  .nav-btn-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 100%;
    flex-wrap: wrap;
  }
`

const ActionButton = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 36px;
  padding: 7px 9px;
  border: 1px solid transparent;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 450;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease,
    color 0.2s ease,
    padding 0.2s ease;
  background-color: transparent;
  color: ${(props) => props.theme.labelFontColor};

  .action-label {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 10px;

    i {
      flex: 0 0 auto;
      width: 16px;
      color: ${(props) => props.theme.disabledFontColor};
      font-size: 16px;
      line-height: 1;
      transition: color 0.2s ease;
    }

    span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  &::after {
    content: '>';
    color: ${(props) => props.theme.disabledFontColor};
    font-size: 14px;
    line-height: 1;
    opacity: 0;
    transform: translateX(-4px);
    transition:
      color 0.2s ease,
      opacity 0.2s ease,
      transform 0.2s ease;
  }

  &:hover {
    background-color: ${(props) => props.theme.hoverColor};
    border-color: ${(props) => props.theme.borderColor};
    color: ${(props) => props.theme.primaryFontColor};
    padding-right: 8px;

    .action-label i {
      color: ${(props) => props.theme.accentColor};
    }

    &::after {
      color: ${(props) => props.theme.primaryFontColor};
      opacity: 1;
      transform: translateX(0);
    }
  }

  &:focus-visible {
    outline: 2px solid ${(props) => props.theme.accentColor};
    outline-offset: 2px;
  }

  &:active {
    background-color: ${(props) => props.theme.bgColorSecondary};
  }
`
