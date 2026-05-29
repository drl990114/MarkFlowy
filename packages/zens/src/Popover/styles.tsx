import * as Ariakit from '@ariakit/react';
import type { IStyledComponent } from 'styled-components';
import styled from 'styled-components';

export const PopoverWrapper: IStyledComponent<'web', typeof Ariakit.Popover> = styled(
  Ariakit.Popover,
)`
  display: flex;
  flex-direction: column;
  border-radius: ${(props) => props.theme.smallBorderRadius};
  border-width: 1px;
  border-style: solid;
  border-color: ${(props) => props.theme.borderColor};
  background-color: ${(props) => props.theme.bgColor};
  padding: ${(props) => props.theme.spaceXs};
  color: ${(props) => props.theme.primaryFontColor};
  outline: none;
`;

export const PopoverArrow = styled(Ariakit.PopoverArrow)`
  font-size: 18px !important;
  stroke: ${(props) => props.theme.borderColor} !important;
  fill: ${(props) => props.theme.bgColor} !important;
  stroke-width: 4 !important;
`;

export const PopoverHeading = styled(Ariakit.PopoverHeading)`
  font-size: ${(props) => props.theme.fontBase};
  font-weight: 'bold';
  margin: ${(props) => props.theme.spaceXs} 0;
`;
