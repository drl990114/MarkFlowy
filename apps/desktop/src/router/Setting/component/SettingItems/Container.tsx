import styled from 'styled-components'

interface SettingItemContainerProps {
  $direction?: 'row' | 'column'
}

export const SettingItemContainer = styled.div<SettingItemContainerProps>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  min-width: 0;
  margin: 0;
  padding: 16px 2px;
  border-bottom: 1px solid var(--mf-border);

  &:last-child {
    border-bottom: 0;
  }

  > * {
    min-width: 0;
    max-width: 100%;
  }

  ${(props) =>
    props.$direction === 'column' &&
    `
      align-items: stretch;
      flex-direction: column;
    `}

  .setting-item__slider {
    width: 120px;
    box-sizing: border-box;
  }

  @media (max-width: 720px) {
    align-items: stretch;
    flex-direction: column;
    gap: 12px;

    > :last-child {
      align-self: flex-start;
    }
  }
`
