import styled from 'styled-components'

interface SettingItemContainerProps {
  $direction?: 'row' | 'column'
  $settingKey?: string
}

export const SettingItemContainer = styled.div.attrs<SettingItemContainerProps>((props) => ({
  'data-setting-key': props.$settingKey,
  tabIndex: props.$settingKey ? -1 : undefined,
}))`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-width: 0;
  margin: 0;
  padding: 12px 0;
  border-bottom: 1px solid color-mix(in srgb, var(--mf-border) 65%, transparent);
  scroll-margin-top: 24px;

  &:focus {
    border-radius: var(--mf-radius-sm, 4px);
    outline: 2px solid ${(props) => props.theme.accentColor};
    outline-offset: 2px;
  }

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

  .setting-item__control {
    flex: 0 0 auto;
    width: 240px;
    max-width: 45%;
  }

  .setting-item__slider {
    flex: 1;
    width: auto;
    min-width: 0;
    box-sizing: border-box;
  }

  @media (max-width: 720px) {
    align-items: stretch;
    flex-direction: column;
    gap: 8px;

    > :last-child {
      align-self: flex-start;
    }

    .setting-item__control {
      width: 100%;
      max-width: 100%;
    }
  }
`
