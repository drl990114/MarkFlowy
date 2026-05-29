import styled from 'styled-components';

export const ShortcutContainer = styled.div`
  display: flex;
  gap: 12px;
  white-space: nowrap;
  align-items: center;
`;

export const ShortcutKeyItem = styled.div`
  display: flex;
  gap: 6px;
  align-items: center;
  font-size: 12px;
`;

export const ShortcutKey = styled.kbd`
  padding: 0 4px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 4px;
  background-color: ${({ theme }) => theme.bgColor};
  border: 1px solid ${({ theme }) => theme.borderColor};
  border-radius: 4px;
  min-width: 24px;
  height: 24px;
  position: relative;
  transition: all 0.2s ease;

  &:hover {
    background-color: ${({ theme }) => theme.hoverColor};
  }

  .shortcut-icon {
    margin-right: 2px;
    font-size: 10px;
  }

  .shortcut-label {
    font-weight: 500;
  }
`;
