import { BoldExtension } from '@rme-sdk/extension-bold';
import { useActive, useCommands } from '@rme-sdk/react-core';
import { FC, useCallback } from 'react';

import { t } from 'i18next';
import { CommandButton, CommandButtonProps } from './command-button';

export interface ToggleBoldButtonProps
  extends Omit<CommandButtonProps, 'commandName' | 'active' | 'enabled' | 'attrs' | 'onSelect'> {}

export const ToggleBoldButton: FC<ToggleBoldButtonProps> = (props) => {
  const { toggleStrong } = useCommands<BoldExtension>();

  const handleSelect = useCallback(() => {
    if (toggleStrong.enabled()) {
      toggleStrong();
    }
  }, [toggleStrong]);

  const active = useActive<BoldExtension>().mdStrong();
  const enabled = toggleStrong.enabled();

  return (
    <CommandButton
      {...props}
      label={t('toolbar.bold')}
      icon="ri-bold"
      commandName='toggleStrong'
      active={active}
      enabled={enabled}
      onSelect={handleSelect}
    />
  );
};
