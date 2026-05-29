import styled from 'styled-components';

import * as Ariakit from '@ariakit/react';

import { darken } from '../Theme';

export const MenuItem = styled(Ariakit.MenuItem)`
  display: flex;
  cursor: default;
  align-items: center;
  border-radius: ${(props) => props.theme.smallBorderRadius};
  padding: ${(props) => props.theme.spaceXs};
  outline: none !important;
  line-height: 20px;
  gap: ${(props) => props.theme.spaceXs};

  &[aria-disabled='true'] {
    opacity: 0.25;
  }

  &[data-active-item] {
    background-color: ${(props) => props.theme.contextMenuBgColorHover};
  }

  &:active,
  &[data-active] {
    background-color: ${(props) => darken(props.theme.contextMenuBgColorHover, 0.2)};
  }

  /* Icon 样式 */
  .dropdown-menu-item-icon,
  .menu-item-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    font-size: 14px;
  }

  /* Label 样式 */
  .dropdown-menu-item-label,
  .menu-item-label {
    flex: 1;
    margin-left: 4px;
  }
`;

export const MenuItemCheckIcon = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  font-weight: bold;
  font-size: 14px;
`;

export const MenuWrapper = styled(Ariakit.Menu)`
  display: flex;
  min-width: 130px;
  flex-direction: column;
  overscroll-behavior: contain;
  border-radius: ${(props) => props.theme.smallBorderRadius};
  border-width: 1px;
  border-style: solid;
  border-color: ${(props) => props.theme.borderColor};
  background-color: ${(props) => props.theme.contextMenuBgColor};
  padding: ${(props) => props.theme.spaceXs};
  color: ${(props) => props.theme.primaryFontColor};
  font-size: ${(props) => props.theme.fontXs};
  outline: none;
  overflow: visible;

  .menu-label {
    flex: 1 1 0%;
    margin-left: 4px;
  }

  .menu-shortcut {
    margin-left: ${(props) => props.theme.spaceXs};
    color: ${(props) => props.theme.secondaryFontColor};
    font-size: ${(props) => props.theme.fontXs};
  }
`;

export const MenuSeparator = styled(Ariakit.MenuSeparator)`
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
  height: 0px;
  width: 100%;
  background-color: ${(props) => props.theme.contextMenuBgColor};
  border-top-width: 1px;
  border-bottom: none;
  border-right: none;
  border-left: none;
  border-color: ${(props) => props.theme.contextMenuSeparatorColor};
  color: ${(props) => props.theme.contextMenuSeparatorColor};
`;
