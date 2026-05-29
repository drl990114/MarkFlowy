import type { MenuProps as AkMenuProps } from '@ariakit/react';
import { MenuButton, MenuButtonArrow, MenuProvider, useMenuStore } from '@ariakit/react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { MenuItem, MenuItemCheckIcon, MenuSeparator, MenuWrapper } from './styles';

import Button from '../Button';

export { MenuProvider } from '@ariakit/react';
export * from './styles';
export { useMenuStore };

export type MenuItemData = MenuGroupType | MenuDividerType;

export type MenuGroupType = {
  label: string;
  shortcut?: string;
  value: string;
  checked?: boolean;
  handler?: () => void;
  children?: MenuItemData[];
};

export type MenuDividerType = {
  type: 'divider';
};

interface MenuProps extends AkMenuProps {
  menuButtonProps?: React.ComponentProps<typeof Button>;
  triggerBtnClass?: string;
  items: MenuItemData[];
  getPopupContainer?: (triggerNode: HTMLElement) => HTMLElement;
}

export const isDivider = (item: MenuItemData): item is MenuDividerType => {
  return (item as MenuDividerType)?.type === 'divider';
};

const Menu = (props: MenuProps) => {
  const {
    open,
    items,
    triggerBtnClass,
    store,
    style,
    children,
    menuButtonProps = {},
    getPopupContainer,
    ...rest
  } = props;

  const triggerRef = useRef<HTMLDivElement>(null);
  const [container, setContainer] = useState<HTMLElement | null>(() => {
    if (typeof document !== 'undefined') {
      return document.body;
    }
    return null;
  });

  useEffect(() => {
    if (getPopupContainer && triggerRef.current) {
      const containerElement = getPopupContainer(triggerRef.current);
      setContainer(containerElement);
    } else {
      setContainer(document.body);
    }
  }, [getPopupContainer]);

  const renderItems = (menuItems: MenuItemData[]) => {
    return menuItems.map((item, index) => {
      if (isDivider(item)) {
        return <MenuSeparator key={index} />;
      }

      const key = item.value;

      if (item.children && item.children?.length > 0) {
        return (
          <MenuProvider key={key}>
            <MenuItem render={<MenuButton />}>
              <MenuItemCheckIcon />
              <span className="menu-label">{item.label}</span>
              {item.shortcut && <span className="menu-shortcut">{item.shortcut}</span>}
              <MenuButtonArrow />
            </MenuItem>
            <MenuWrapper>{renderItems(item.children)}</MenuWrapper>
          </MenuProvider>
        );
      } else {
        return (
          <MenuItem
            key={key}
            onClick={() => {
              if (item.handler) {
                item.handler();
              }
            }}
          >
            <MenuItemCheckIcon>
              {item.checked ? <i className="ri-check-line" /> : null}
            </MenuItemCheckIcon>
            <span className="menu-label">{item.label}</span>
            {item.shortcut && <span className="menu-shortcut">{item.shortcut}</span>}
          </MenuItem>
        );
      }
    });
  };

  if (store) {
    const menuContent = (
      <MenuWrapper style={style} store={store} {...rest}>
        {renderItems(items)}
      </MenuWrapper>
    );
    
    return container ? createPortal(menuContent, container) : menuContent;
  }

  return (
    <MenuProvider>
      {children ? (
        <MenuButton
          ref={triggerRef as any}
          render={(p) => <Button {...p} {...menuButtonProps} />}
          className={triggerBtnClass}
        >
          {children}
        </MenuButton>
      ) : null}
      {container ? createPortal(
        <MenuWrapper style={style} open={open} {...rest}>
          {renderItems(items)}
        </MenuWrapper>,
        container
      ) : (
        <MenuWrapper style={style} open={open} {...rest}>
          {renderItems(items)}
        </MenuWrapper>
      )}
    </MenuProvider>
  );
};

export default Menu;
