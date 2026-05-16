import { CoreIcon, isString } from '@rme-sdk/core';
import { FC, JSX } from 'react';

export interface CommandButtonIconProps {
  icon: CoreIcon | JSX.Element | null | string;
}

export const CommandButtonIcon: FC<CommandButtonIconProps> = ({ icon }) => {
  if (isString(icon)) {
    return <i className={icon}></i>
  }

  return icon;
};
