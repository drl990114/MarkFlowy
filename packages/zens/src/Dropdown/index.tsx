import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from 'react';
import Button from '../Button';
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItemPrimitive,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuArrow,
  type DropdownMenuContentProps,
} from '../components/dropdown-menu';
import { Toolbar, ToolbarButton, ToolbarSeparator } from '../components/toolbar';

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
  label: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
  danger?: boolean;
  checked?: boolean;
  onClick?: () => void;
  children?: DropdownMenuItem[];
}
export interface DropdownMenuDividerType {
  type: 'divider';
}
export type DropdownMenuItem = MenuItemType | DropdownMenuDividerType;
export interface ToolbarItem {
  key: string;
  icon: ReactNode;
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
export interface DropdownProps
  extends Omit<DropdownMenuContentProps, 'children' | 'onClick' | 'onOpenChange'> {
  menu?: DropdownMenuProps;
  arrow?: boolean | { pointAtCenter: boolean };
  disabled?: boolean;
  dropdownRender?: (menus: ReactNode) => ReactNode;
  getPopupContainer?: (triggerNode: HTMLElement) => HTMLElement;
  overlayClassName?: string;
  overlayStyle?: CSSProperties;
  placement?: DropdownPlacement;
  trigger?: DropdownTrigger[];
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean, info?: { source: 'trigger' | 'menu' }) => void;
  loading?: ComponentProps<typeof Button>['loading'];
  danger?: boolean;
  icon?: ReactNode;
  size?: ComponentProps<typeof Button>['size'];
  type?: ComponentProps<typeof Button>['btnType'];
  onClick?: ComponentProps<typeof Button>['onClick'];
  children?: ReactNode;
  customTrigger?: ReactElement;
  /** A point anchor is used by the host's imperative context menu. */
  anchorPoint?: { x: number; y: number };
  /** Preserve an editor's own click/drag behavior while positioning the menu at its control. */
  anchorElement?: HTMLElement | null;
  manualTrigger?: ReactNode;
}
const placementMap = {
  bottomLeft: ['bottom', 'start'],
  bottomCenter: ['bottom', 'center'],
  bottomRight: ['bottom', 'end'],
  topLeft: ['top', 'start'],
  topCenter: ['top', 'center'],
  topRight: ['top', 'end'],
  leftTop: ['left', 'start'],
  leftCenter: ['left', 'center'],
  leftBottom: ['left', 'end'],
  rightTop: ['right', 'start'],
  rightCenter: ['right', 'center'],
  rightBottom: ['right', 'end'],
} as const;
const isDivider = (item: DropdownMenuItem | DropdownToolbarItem): item is DropdownMenuDividerType =>
  'type' in item && item.type === 'divider';

export default function Dropdown({
  menu,
  arrow = false,
  disabled = false,
  dropdownRender,
  getPopupContainer,
  overlayClassName,
  overlayStyle,
  placement = 'bottomLeft',
  trigger = ['hover'],
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  loading,
  danger,
  icon,
  size = 'medium',
  type = 'default',
  onClick,
  children,
  customTrigger,
  anchorPoint,
  anchorElement,
  manualTrigger,
  container: suppliedContainer,
  onCloseAutoFocus,
  ...contentProps
}: DropdownProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = controlledOpen ?? internalOpen;
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  useLayoutEffect(() => {
    if (!open || !anchorElement) return;
    const update = () => setAnchorRect(anchorElement.getBoundingClientRect());
    update();
    const ownerWindow = anchorElement.ownerDocument.defaultView;
    ownerWindow?.addEventListener('scroll', update, true);
    ownerWindow?.addEventListener('resize', update);
    return () => {
      ownerWindow?.removeEventListener('scroll', update, true);
      ownerWindow?.removeEventListener('resize', update);
    };
  }, [open, anchorElement]);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingAction = useRef<(() => void) | undefined>(undefined);
  const [side, align] = placementMap[placement];
  const [customContainer, setCustomContainer] = useState<HTMLElement>();
  useLayoutEffect(() => {
    setCustomContainer(triggerRef.current ? getPopupContainer?.(triggerRef.current) : undefined);
  }, [getPopupContainer, open]);
  const container = suppliedContainer ?? customContainer;
  const setOpen = (next: boolean, source: 'trigger' | 'menu' = 'trigger') => {
    if (disabled && next) return;
    setInternalOpen(next);
    onOpenChange?.(next, { source });
  };
  const clearHoverTimer = () => {
    clearTimeout(hoverTimer.current);
  };
  useEffect(() => () => clearTimeout(hoverTimer.current), []);
  const enter = () => {
    clearHoverTimer();
    if (trigger.includes('hover')) setOpen(true);
  };
  const leave = () => {
    if (trigger.includes('hover')) hoverTimer.current = setTimeout(() => setOpen(false), 100);
  };
  const select = (action: () => void) => {
    pendingAction.current = action;
    setOpen(false, 'menu');
  };
  const renderItems = (items: DropdownMenuItem[]): ReactNode =>
    items.map((item, index) => {
      if (isDivider(item)) return <DropdownMenuSeparator key={`divider-${index}`} />;
      const label = (
        <>
          {item.icon}
          <span className="dropdown-menu-item-label mfc:flex-1">{item.label}</span>
          {item.checked !== undefined && <span aria-hidden>{item.checked ? '✓' : ''}</span>}
        </>
      );
      if (item.children?.length)
        return (
          <DropdownMenuSub key={item.key}>
            <DropdownMenuSubTrigger disabled={item.disabled}>{label}</DropdownMenuSubTrigger>
            <DropdownMenuSubContent
              container={container}
              className={overlayClassName}
              style={overlayStyle}
            >
              <div className="dropdown-menu-scroll-area">{renderItems(item.children)}</div>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        );
      if (item.checked !== undefined) {
        return (
          <DropdownMenuCheckboxItem
            key={item.key}
            checked={item.checked}
            disabled={item.disabled}
            onSelect={() =>
              select(() => {
                item.onClick?.();
                menu?.onClick?.(item);
              })
            }
          >
            {label}
          </DropdownMenuCheckboxItem>
        );
      }
      return (
        <DropdownMenuItemPrimitive
          key={item.key}
          disabled={item.disabled}
          data-danger={item.danger || undefined}
          className={item.danger ? 'mfc:text-destructive' : undefined}
          onSelect={() =>
            select(() => {
              item.onClick?.();
              menu?.onClick?.(item);
            })
          }
        >
          {label}
        </DropdownMenuItemPrimitive>
      );
    });
  const content = (
    <>
      {menu?.toolbar && (
        <Toolbar
          aria-label="Menu actions"
          className="mfc:mb-1 mfc:flex-wrap mfc:border-b mfc:border-control-border mfc:p-1"
        >
          {menu.toolbar.items.map((item, index) =>
            isDivider(item) ? (
              <ToolbarSeparator key={`divider-${index}`} />
            ) : (
              <ToolbarButton
                key={item.key}
                disabled={item.disabled}
                aria-label={item.label}
                aria-pressed={item.active}
                className="mfc:gap-1 mfc:px-2 mfc:py-1 mfc:hover:bg-control-hover mfc:aria-pressed:bg-control-selected"
                onClick={() =>
                  select(() => {
                    item.onClick?.();
                    menu.toolbar?.onClick?.(item);
                  })
                }
              >
                {item.icon}
                {item.label}
              </ToolbarButton>
            ),
          )}
        </Toolbar>
      )}
      <div className="dropdown-menu-scroll-area">{renderItems(menu?.items ?? [])}</div>
    </>
  );
  return (
    <DropdownMenuRoot open={open} onOpenChange={setOpen} modal={false}>
      {manualTrigger}
      <span ref={triggerRef} className="mfc:inline-flex" onMouseEnter={enter} onMouseLeave={leave}>
        <DropdownMenuTrigger
          asChild
          disabled={disabled}
          onPointerDown={(event) => {
            if (!trigger.includes('click') || anchorPoint || manualTrigger) event.preventDefault();
          }}
          onContextMenu={(event) => {
            if (trigger.includes('contextMenu')) {
              event.preventDefault();
              setOpen(!open);
            }
          }}
        >
          {anchorPoint || manualTrigger ? (
            <button
              type="button"
              tabIndex={-1}
              aria-hidden
              style={{
                position: 'fixed',
                left: anchorPoint?.x ?? anchorRect?.left ?? 0,
                top: anchorPoint?.y ?? anchorRect?.top ?? 0,
                width: anchorRect?.width ?? 0,
                height: anchorRect?.height ?? 0,
                padding: 0,
                border: 0,
                pointerEvents: 'none',
              }}
            />
          ) : (
            (customTrigger ?? (
              <Button
                size={size}
                btnType={type}
                danger={danger}
                loading={loading}
                disabled={disabled}
                onClick={onClick}
              >
                {icon}
                {children}
              </Button>
            ))
          )}
        </DropdownMenuTrigger>
      </span>
      <DropdownMenuContent
        {...contentProps}
        container={container}
        side={side}
        align={align}
        sideOffset={anchorPoint ? 0 : 4}
        className={overlayClassName ?? contentProps.className}
        style={overlayStyle ?? contentProps.style}
        onMouseEnter={enter}
        onMouseLeave={leave}
        onCloseAutoFocus={(event) => {
          onCloseAutoFocus?.(event);
          if (manualTrigger && anchorElement && !event.defaultPrevented) {
            event.preventDefault();
            if (anchorElement.isConnected) anchorElement.focus({ preventScroll: true });
          }
          const action = pendingAction.current;
          pendingAction.current = undefined;
          if (action) queueMicrotask(action);
        }}
      >
        {dropdownRender ? dropdownRender(content) : content}
        {arrow && <DropdownMenuArrow className="mfc:fill-surface-overlay" />}
      </DropdownMenuContent>
    </DropdownMenuRoot>
  );
}
