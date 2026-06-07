import type { MenuProps as AkMenuProps } from '@ariakit/react';
import { MenuButton, MenuButtonArrow, MenuProvider, useMenuStore } from '@ariakit/react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Box } from '../Box';
import Button from '../Button';
import { MenuItem, MenuSeparator, MenuWrapper } from '../Menu/styles';
import {
  DropdownArrow,
  DropdownButtonWrapper,
  DropdownMenuScrollArea,
  DropdownToolbar,
  DropdownToolbarDivider,
  DropdownToolbarItem,
  DropdownWrapper
} from './styles';

export type DropdownPlacement =
  | 'bottomLeft'
  | 'bottomCenter'
  | 'bottomRight'
  | 'topLeft'
  | 'topCenter'
  | 'topRight'
  | 'leftTop'
  | 'leftCenter'
  | 'leftBottom'
  | 'rightTop'
  | 'rightCenter'
  | 'rightBottom';

export type DropdownTrigger = 'click' | 'hover' | 'contextMenu';

export interface MenuItemType {
  key: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
  danger?: boolean;
  onClick?: () => void;
  children?: DropdownMenuItem[];
}

export interface DropdownMenuDividerType {
  type: 'divider';
}

export type DropdownMenuItem = MenuItemType | DropdownMenuDividerType;

export interface ToolbarItem {
  key: string;
  icon: React.ReactNode;
  label?: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

export interface DropdownToolbarDividerType {
  type: 'divider';
}

export type DropdownToolbarItem = ToolbarItem | DropdownToolbarDividerType;

export interface DropdownToolbarConfig {
  items: DropdownToolbarItem[];
  onClick?: (item: ToolbarItem) => void;
}

export interface DropdownMenuProps {
  items: DropdownMenuItem[];
  toolbar?: DropdownToolbarConfig;
  onClick?: (item: MenuItemType) => void;
}

export interface DropdownProps extends Omit<AkMenuProps, 'placement'> {
  /**
   * 菜单配置项
   */
  menu?: DropdownMenuProps;
  /**
   * 是否显示箭头
   * @default false
   */
  arrow?: boolean | { pointAtCenter: boolean };
  /**
   * 是否自动调整位置
   * @default true
   */
  autoAdjustOverflow?: boolean;
  /**
   * 是否自动聚焦
   * @default false
   */
  autoFocus?: boolean;
  /**
   * 是否禁用
   * @default false
   */
  disabled?: boolean;
  /**
   * 隐藏时是否销毁弹出层
   * @default false
   */
  destroyPopupOnHide?: boolean;
  /**
   * 自定义下拉框渲染
   */
  dropdownRender?: (menus: React.ReactNode) => React.ReactNode;
  /**
   * 弹出层挂载容器
   * @default () => document.body
   */
  getPopupContainer?: (triggerNode: HTMLElement) => HTMLElement;
  /**
   * 下拉框类名
   */
  overlayClassName?: string;
  /**
   * 下拉框样式
   */
  overlayStyle?: React.CSSProperties;
  /**
   * 弹出位置
   * @default 'bottomLeft'
   */
  placement?: DropdownPlacement;
  /**
   * 触发方式
   * @default ['hover']
   */
  trigger?: DropdownTrigger[];
  /**
   * 是否打开（受控）
   */
  open?: boolean;
  /**
   * 展开状态变化回调
   */
  onOpenChange?: (open: boolean, info?: { source: 'trigger' | 'menu' }) => void;
  /**
   * 按钮渲染器
   */
  buttonsRender?: (buttons: React.ReactNode[]) => React.ReactNode[];
  /**
   * 是否加载中
   * @default false
   */
  loading?: boolean | { delay: number; icon?: React.ReactNode };
  /**
   * 是否为危险按钮
   * @default false
   */
  danger?: boolean;
  /**
   * 按钮图标
   */
  icon?: React.ReactNode;
  /**
   * 按钮尺寸
   * @default 'medium'
   */
  size?: 'large' | 'medium' | 'small';
  /**
   * 按钮类型
   * @default 'default'
   */
  type?: 'primary' | 'dashed' | 'link' | 'text' | 'default';
  /**
   * 按钮点击回调
   */
  onClick?: (event: React.MouseEvent<HTMLElement>) => void;
  /**
   * 子元素（通常是按钮文字）
   */
  children?: React.ReactNode;
  /**
   * 自定义触发元素
   */
  customTrigger?: React.ReactNode;
  /**
   * 虚拟触发元素，用于 fixed 定位场景
   * 当 trigger 元素使用 fixed 定位时，可以通过此属性提供一个虚拟元素用于菜单定位
   */
  virtualTrigger?: HTMLElement | null;
  /**
   * 是否直接渲染 children 而不添加任何包裹元素
   * 当设置为 true 时，children 需要自行处理 onClick、onContextMenu 等事件
   * 并通过 triggerRef 获取触发元素引用
   * @default false
   */
  raw?: boolean;
  /**
   * 触发元素 ref，用于 raw 模式下获取触发元素
   */
  triggerRef?: React.RefObject<HTMLElement | null>;
}

const isDivider = (item: DropdownMenuItem): item is DropdownMenuDividerType => {
  return (item as DropdownMenuDividerType)?.type === 'divider';
};

const isToolbarDivider = (item: DropdownToolbarItem): item is DropdownToolbarDividerType => {
  return (item as DropdownToolbarDividerType)?.type === 'divider';
};

const placementMap: Record<DropdownPlacement, string> = {
  bottomLeft: 'bottom-start',
  bottomCenter: 'bottom',
  bottomRight: 'bottom-end',
  topLeft: 'top-start',
  topCenter: 'top',
  topRight: 'top-end',
  leftTop: 'left-start',
  leftCenter: 'left',
  leftBottom: 'left-end',
  rightTop: 'right-start',
  rightCenter: 'right',
  rightBottom: 'right-end',
};

const Dropdown: React.FC<DropdownProps> = (props) => {
  const {
    arrow = false,
    disabled = false,
    destroyPopupOnHide = false,
    dropdownRender,
    getPopupContainer,
    overlayClassName,
    overlayStyle,
    placement = 'bottomLeft',
    trigger = ['hover'],
    open: controlledOpen,
    onOpenChange,
    buttonsRender,
    loading = false,
    danger = false,
    icon,
    size = 'medium',
    type = 'default',
    onClick,
    children,
    customTrigger,
    virtualTrigger,
    raw = false,
    triggerRef: externalTriggerRef,
    menu,
    ...rest
  } = props;

  const internalTriggerRef = useRef<HTMLDivElement>(null);
  const triggerRef = (externalTriggerRef as React.RefObject<HTMLDivElement>) || internalTriggerRef;
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [container, setContainer] = useState<HTMLElement | null>(() => {
    if (typeof document !== 'undefined') {
      return document.body;
    }
    return null;
  });

  const store = useMenuStore({
    placement: placementMap[placement] as any,
    focusLoop: false,
    focusWrap: false,
  });

  const isOpen = controlledOpen !== undefined ? controlledOpen : store.useState('open');

  useEffect(() => {
    if (controlledOpen !== undefined) {
      store.setOpen(controlledOpen);
    }
  }, [controlledOpen, store]);

  useEffect(() => {
    if (getPopupContainer && triggerRef.current) {
      const containerElement = getPopupContainer(triggerRef.current);
      setContainer(containerElement);
    } else {
      setContainer(document.body);
    }
  }, [getPopupContainer]);

  const handleOpenChange = (open: boolean) => {
    if (controlledOpen === undefined) {
      store.setOpen(open);
    }
    onOpenChange?.(open, { source: 'trigger' });
  };

  const handleClick = () => {
    if (trigger.includes('click')) {
      handleOpenChange(!isOpen);
    }
    onClick?.(undefined as any);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (trigger.includes('contextMenu')) {
      e.preventDefault();
      handleOpenChange(!isOpen);
    }
  };

  const handleMouseEnter = () => {
    if (trigger.includes('hover')) {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = null;
      }
      handleOpenChange(true);
    }
  };

  const handleMouseLeave = () => {
    if (trigger.includes('hover')) {
      hoverTimeoutRef.current = setTimeout(() => {
        handleOpenChange(false);
      }, 100);
    }
  };

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  const showArrow = typeof arrow === 'boolean' ? arrow : true;

  const useClickTrigger = trigger.includes('click');
  const useHoverTrigger = trigger.includes('hover');
  const useContextMenuTrigger = trigger.includes('contextMenu');

  const buttonContent = raw ? (
    // raw 模式：直接渲染 children，不添加任何包裹元素
    <>{children}</>
  ) : customTrigger ? (
    <Box
      ref={triggerRef}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ display: 'inline-block' }}
    >
      {customTrigger}
    </Box>
  ) : (
    <DropdownButtonWrapper
      ref={triggerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <MenuButton
        render={
          <Button
            size={size}
            btnType={type === 'default' ? 'default' : type}
            danger={danger}
            loading={loading}
            disabled={disabled}
            onClick={handleClick}
            onContextMenu={handleContextMenu}
          />
        }
        toggleOnClick={useClickTrigger ? false : undefined}
      >
        {icon && <span className="dropdown-icon">{icon}</span>}
        {children && <span className="dropdown-text">{children}</span>}
        {showArrow && (
          <DropdownArrow className="dropdown-arrow">
            <svg
              viewBox="0 0 1024 1024"
              focusable="false"
              data-icon="down"
              width="1em"
              height="1em"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M884 256h-75c-5.1 0-9.9 2.5-12.9 6.6L512 654.7 227.9 262.6c-3-4.1-7.8-6.6-12.9-6.6h-75c-6.5 0-10.3 7.4-6.5 12.7l352.6 486.3c3.2 4.4 9.7 4.4 12.9 0l352.6-486.3c3.9-5.3.1-12.7-6.4-12.7z" />
            </svg>
          </DropdownArrow>
        )}
      </MenuButton>
    </DropdownButtonWrapper>
  );

  const finalButtons = buttonsRender && !raw ? buttonsRender([buttonContent]) : [buttonContent];

  const renderMenuItems = (items: DropdownMenuItem[]) => {
    return items.map((item, index) => {
      if (isDivider(item)) {
        return <MenuSeparator key={`divider-${index}`} />;
      }

      const { key, label, icon, disabled: itemDisabled, danger, onClick: itemOnClick, children } = item;

      // 如果有子菜单，使用 MenuProvider 和 MenuButton 渲染
      if (children && children.length > 0) {
        return (
          <MenuProvider key={key}>
            <MenuItem render={<MenuButton />} disabled={itemDisabled}>
              {icon && <span className="dropdown-menu-item-icon">{icon}</span>}
              <span className="dropdown-menu-item-label">{label}</span>
              <MenuButtonArrow />
            </MenuItem>
            <MenuWrapper className={overlayClassName}>
              <DropdownMenuScrollArea className="dropdown-menu-scroll-area">
                {renderMenuItems(children)}
              </DropdownMenuScrollArea>
            </MenuWrapper>
          </MenuProvider>
        );
      }

      const handleItemClick = () => {
        if (!itemDisabled) {
          itemOnClick?.();
          menu?.onClick?.(item);
          handleOpenChange(false);
        }
      };

      return (
        <MenuItem
          key={key}
          disabled={itemDisabled}
          onClick={handleItemClick}
          data-danger={danger}
        >
          {icon && <span className="dropdown-menu-item-icon">{icon}</span>}
          <span className="dropdown-menu-item-label">{label}</span>
        </MenuItem>
      );
    });
  };

  const renderToolbar = () => {
    if (!menu?.toolbar?.items) return null;

    return (
      <DropdownToolbar>
        {menu.toolbar.items.map((item, index) => {
          if (isToolbarDivider(item)) {
            return <DropdownToolbarDivider key={`toolbar-divider-${index}`} />;
          }

          const { key, icon, label, active, disabled: itemDisabled, onClick: itemOnClick } = item;

          const handleToolbarClick = () => {
            if (!itemDisabled) {
              itemOnClick?.();
              menu?.toolbar?.onClick?.(item);
              handleOpenChange(false);
            }
          };

          return (
            <DropdownToolbarItem
              key={key}
              $active={active}
              disabled={itemDisabled}
              onClick={handleToolbarClick}
              aria-pressed={active}
              title={label}
            >
              {icon}
              {label && <span style={{ marginLeft: 4 }}>{label}</span>}
            </DropdownToolbarItem>
          );
        })}
      </DropdownToolbar>
    );
  };

  const getAnchorRect = virtualTrigger
    ? () => virtualTrigger.getBoundingClientRect()
    : raw && triggerRef.current
      ? () => triggerRef.current?.getBoundingClientRect() || null
      : undefined;

  // 处理菜单关闭事件（点击外部、按 ESC 等）
  const handleMenuClose = () => {
    if (controlledOpen === undefined) {
      store.setOpen(false);
    }
    onOpenChange?.(false, { source: 'menu' });
  };

  const menuContent = menu?.items ? (
    <MenuWrapper
      store={store}
      className={overlayClassName}
      style={overlayStyle}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClose={handleMenuClose}
      getAnchorRect={getAnchorRect}
      {...rest}
    >
      {renderToolbar()}
      <DropdownMenuScrollArea className="dropdown-menu-scroll-area">
        {renderMenuItems(menu.items)}
      </DropdownMenuScrollArea>
    </MenuWrapper>
  ) : null;

  const content = dropdownRender ? dropdownRender(menuContent) : menuContent;

  if (destroyPopupOnHide && !isOpen) {
    return raw ? (
      <>{finalButtons[0]}</>
    ) : (
      <DropdownWrapper>
        {finalButtons[0]}
      </DropdownWrapper>
    );
  }

  const menuElement = content && container ? createPortal(content, container) : content;

  // raw 模式：不添加任何包裹元素，直接渲染 children 和菜单
  if (raw) {
    return (
      <MenuProvider store={store}>
        {finalButtons[0]}
        {menuElement}
      </MenuProvider>
    );
  }

  return (
    <DropdownWrapper>
      <MenuProvider store={store}>
        {finalButtons[0]}
        {menuElement}
      </MenuProvider>
    </DropdownWrapper>
  );
};

export default Dropdown;
