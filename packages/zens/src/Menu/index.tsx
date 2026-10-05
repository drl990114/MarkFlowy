import type { ComponentProps } from 'react';
import Button from '../Button';
import Dropdown, { type DropdownMenuItem, type DropdownProps } from '../Dropdown';

export type MenuItemData = MenuGroupType | MenuDividerType;
export type MenuGroupType = {
  label: string;
  shortcut?: string;
  commandId?: string;
  value: string;
  checked?: boolean;
  disabled?: boolean;
  handler?: () => void;
  children?: MenuItemData[];
};
export type MenuDividerType = { type: 'divider' };
export const isDivider = (item: MenuItemData): item is MenuDividerType =>
  'type' in item && item.type === 'divider';
export interface MenuProps extends Omit<DropdownProps, 'menu' | 'type' | 'customTrigger'> {
  items: MenuItemData[];
  menuButtonProps?: ComponentProps<typeof Button>;
  triggerBtnClass?: string;
}
function mapItems(items: MenuItemData[]): DropdownMenuItem[] {
  return items.map((item) =>
    isDivider(item)
      ? item
      : {
          key: item.value,
          label: (
            <>
              <span className="menu-label">{item.label}</span>
              {item.shortcut && (
                <span className="menu-shortcut mfc:ml-auto mfc:pl-4 mfc:text-content-muted">
                  {item.shortcut}
                </span>
              )}
            </>
          ),
          checked: item.checked,
          disabled: item.disabled,
          onClick: item.handler,
          children: item.children ? mapItems(item.children) : undefined,
        },
  );
}
export default function Menu({
  items,
  menuButtonProps,
  triggerBtnClass,
  children,
  ...props
}: MenuProps) {
  return (
    <Dropdown
      trigger={['click']}
      {...props}
      menu={{ items: mapItems(items) }}
      customTrigger={
        <Button {...menuButtonProps} className={triggerBtnClass ?? menuButtonProps?.className}>
          {children}
        </Button>
      }
    />
  );
}
