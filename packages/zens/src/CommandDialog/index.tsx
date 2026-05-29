import React, { useEffect, useState } from 'react';

import clsx from 'clsx';

import type { DialogProps as AkDialogProps } from '@ariakit/react';
import {
  Combobox,
  ComboboxItem,
  ComboboxList,
  ComboboxProvider,
  DialogDismiss,
  useComboboxStore,
} from '@ariakit/react';

import {
  CommandDialogWrapper,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from './styles';

import Dialog from '../Dialog';
import { Shortcut } from '../Shortcut';

export interface CommandAction {
  /** Unique identifier for the action */
  id: string;
  /** Display text for the action */
  label: string;
  /** Optional description or subtitle */
  description?: string;
  /** Optional icon component */
  icon?: React.ReactNode;
  /** Optional shortcut display */
  shortcut?: { keybindings: { key: string }[] }[];
  /** Optional group/category */
  group?: string;
  /** Whether the action is disabled */
  disabled?: boolean;
  /** Callback when action is selected */
  onSelect?: () => void;
}

export interface CommandDialogProps extends Omit<AkDialogProps, 'children' | 'onSelect'> {
  /** Array of available actions/commands */
  actions?: CommandAction[];
  /** Placeholder text for the search input */
  placeholder?: string;
  /** Text to show when no results found */
  emptyText?: string;
  /** Custom filter function */
  filter?: (actions: CommandAction[], search: string) => CommandAction[];
  /** Callback when an action is selected */
  onSelect?: (action: CommandAction) => void;
  /** Custom class name for the container */
  containerClass?: string;
  /** Width of the dialog */
  width?: string;
  /** Callback when the dialog should be closed */
  onClose?: () => void;
}

const defaultFilter = (actions: CommandAction[], search: string): CommandAction[] => {
  if (!search.trim()) return actions;

  const searchLower = search.toLowerCase();
  return actions.filter(
    (action) =>
      action.label.toLowerCase().includes(searchLower) ||
      action.description?.toLowerCase().includes(searchLower) ||
      action.group?.toLowerCase().includes(searchLower),
  );
};

const CommandDialog: React.FC<CommandDialogProps> = (props) => {
  const {
    actions = [],
    placeholder = 'Type a command or search...',
    emptyText = 'No results found.',
    filter = defaultFilter,
    onSelect,
    onClose,
    containerClass,
    width,
    ...rest
  } = props;

  const [search, setSearch] = useState('');
  const combobox = useComboboxStore();

  // Filter actions based on search
  const filteredActions = filter(actions, search);

  // Group actions by group
  const groupedActions: Record<string, CommandAction[]> = {};
  filteredActions.forEach((action) => {
    const group = action.group || 'default';
    if (!groupedActions[group]) {
      groupedActions[group] = [];
    }
    groupedActions[group].push(action);
  });

  // Handle action selection
  const handleActionSelect = (action: CommandAction) => {
    if (action.disabled) return;

    action.onSelect?.();
    onSelect?.(action);

    // Close the dialog
    onClose?.();
  };

  // Handle input change
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setSearch(value);
    combobox.setValue(value);
  };

  // Handle keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      onClose?.();
    }
  };

  // Reset search when dialog opens/closes
  useEffect(() => {
    if (rest.open) {
      setSearch('');
      combobox.setValue('');
    }
  }, [rest.open, combobox]);

  return (
    <Dialog
      onClose={onClose}
      hideDismiss
      width="600px"
      style={{
        top: '100px',
        transform: 'translate(-50%, 0%)',
        maxHeight: '70vh',
        borderRadius: '8px',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
      }}
      {...rest}
    >
      <CommandDialogWrapper>
        <ComboboxProvider store={combobox}>
          <div className={clsx('mf-command-dialog__container', containerClass)}>
            <div className="mf-command-dialog__header">
              <CommandInput
                as={Combobox}
                placeholder={placeholder}
                value={search}
                onChange={handleSearchChange}
                onKeyDown={handleKeyDown}
                autoFocus
              />
              <DialogDismiss className="mf-command-dialog__dismiss">esc</DialogDismiss>
            </div>

            {/* Command List */}
            <CommandList as={ComboboxList} alwaysVisible className="mf-command-dialog__list">
              {filteredActions.length === 0 ? (
                <CommandEmpty>{emptyText}</CommandEmpty>
              ) : (
                Object.entries(groupedActions).map(([groupName, groupActions], groupIndex) => (
                  <React.Fragment key={groupName}>
                    {groupIndex > 0 && <CommandSeparator />}

                    {groupName !== 'default' && <CommandGroup>{groupName}</CommandGroup>}

                    {groupActions.map((action) => (
                      <CommandItem
                        key={action.id}
                        as={ComboboxItem}
                        value={action.id}
                        disabled={action.disabled}
                        onClick={() => handleActionSelect(action)}
                        className={clsx(
                          'mf-command-dialog__item',
                          action.disabled && 'mf-command-dialog__item--disabled',
                        )}
                      >
                        <div className="mf-command-dialog__item-content">
                          {action.icon && (
                            <div className="mf-command-dialog__item-icon">{action.icon}</div>
                          )}
                          <div className="mf-command-dialog__item-text">
                            <div className="mf-command-dialog__item-label">{action.label}</div>
                            {action.description && (
                              <div className="mf-command-dialog__item-description">
                                {action.description}
                              </div>
                            )}
                          </div>
                          {action.shortcut && <Shortcut dataSource={action.shortcut} />}
                        </div>
                      </CommandItem>
                    ))}
                  </React.Fragment>
                ))
              )}
            </CommandList>
          </div>
        </ComboboxProvider>
      </CommandDialogWrapper>
    </Dialog>
  );
};

export default CommandDialog;
