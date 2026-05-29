import React, { FC } from 'react';

import { ShortcutContainer, ShortcutKey, ShortcutKeyItem } from './styles';

interface Shortcut {
  keybindings: { key: React.ReactNode }[];
  icon?: React.ReactNode;
  desc?: string;
}

interface ShortcutProps {
  dataSource: Shortcut[];
}

export const Shortcut: FC<ShortcutProps> = (props) => {
  const { dataSource = [] } = props;

  return (
    <ShortcutContainer>
      {dataSource.map((item, index) => (
        <ShortcutKeyItem key={index}>
          {item.icon && <span className="shortcut-icon">{item.icon}</span>}
          <ShortcutKey>
            {item.keybindings.map((binding, bindingIndex) => (
              <>
                {binding.key}
                {bindingIndex < item.keybindings.length - 1 && <span className="shortcut-separator">+</span>}
              </>
            ))}
          </ShortcutKey>
          {item.desc && <span className="shortcut-desc">{item.desc}</span>}
        </ShortcutKeyItem>
      ))}
    </ShortcutContainer>
  );
};
