import { HeadingExtension, HeadingExtensionAttributes } from '@rme-sdk/extension-heading';
import { useActive, useCommands } from '@rme-sdk/react-core';
import { FC, useCallback } from 'react';

import { t } from 'i18next';
import { CommandButton, CommandButtonProps } from './command-button';

export interface ToggleHeadingButtonProps
  extends Omit<CommandButtonProps, 'commandName' | 'active' | 'enabled' | 'attrs' | 'onSelect'> {
  attrs?: Partial<HeadingExtensionAttributes>;
}

export const ToggleHeadingButton: FC<ToggleHeadingButtonProps> = ({ attrs, ...rest }) => {
  const { toggleHeading } = useCommands<HeadingExtension>();

  const handleSelect = useCallback(() => {
    if (toggleHeading.enabled(attrs)) {
      toggleHeading(attrs);
    }
  }, [toggleHeading, attrs]);

  const active = useActive<HeadingExtension>().heading(attrs);
  const enabled = toggleHeading.enabled(attrs);

  return (
    <CommandButton
      {...rest}
      label={t('toolbar.heading')}
      icon="ri-heading"
      commandName='toggleHeading'
      active={active}
      enabled={enabled}
      attrs={attrs}
      onSelect={handleSelect}
    />
  );
};
