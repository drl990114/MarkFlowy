import styled from 'styled-components';

import { darken } from '../Theme';

export const DropdownWrapper = styled.div`
  display: inline-block;
  position: relative;
`;

export const DropdownButtonWrapper = styled.div`
  display: inline-flex;
  align-items: center;

  .dropdown-icon {
    display: inline-flex;
    align-items: center;
    margin-right: 8px;
  }

  .dropdown-text {
    display: inline-flex;
    align-items: center;
  }
`;

export const DropdownArrow = styled.span`
  display: inline-flex;
  align-items: center;
  margin-left: 8px;
  font-size: 12px;
  transition: transform 0.3s;

  [aria-expanded='true'] & {
    transform: rotate(180deg);
  }
`;

export const DropdownOverlay = styled.div`
  position: relative;
  z-index: 1050;
`;

export const DropdownToolbar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  padding: 8px;
  border-bottom: 1px solid ${(props) => props.theme.borderColor};
  margin-bottom: ${(props) => props.theme.spaceXs};
`;

export const DropdownToolbarItem = styled.button<{ $active?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 10px;
  border: none;
  background-color: transparent;
  cursor: pointer;
  border-radius: ${(props) => props.theme.smallBorderRadius};
  color: ${(props) => props.theme.primaryFontColor};
  font-size: 14px;
  line-height: 1;
  transition: all 0.2s;

  &:hover {
    background-color: ${(props) => props.theme.contextMenuBgColorHover};
  }

  &:active,
  &[aria-pressed='true'] {
    background-color: ${(props) => darken(props.theme.contextMenuBgColorHover, 0.1)};
  }

  ${(props) =>
    props.$active &&
    `
    background-color: ${props.theme.contextMenuBgColorHover};
    color: ${props.theme.primaryFontColor};
    font-weight: 500;
  `}

  &:disabled {
    opacity: 0.25;
    cursor: not-allowed;

    &:hover {
      background-color: transparent;
    }
  }
`;

export const DropdownToolbarDivider = styled.div`
  width: 1px;
  height: 20px;
  background-color: ${(props) => props.theme.borderColor};
  margin: 0 4px;
`;

export const DropdownMenuScrollArea = styled.div`
  min-height: 0;
  overflow: visible;
`;
