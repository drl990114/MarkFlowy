import React, { useCallback, useState } from 'react';

import { Button, CommandAction, CommandDialog, Icon } from 'zens';

const BasicDemo: React.FC = () => {
  const [open, setOpen] = useState(false);

  const show = useCallback(() => {
    setOpen(true);
  }, []);

  const hide = useCallback(() => {
    setOpen(false);
  }, []);

  const actions: CommandAction[] = [
    {
      id: 'new-file',
      label: 'New File',
      description: 'Create a new file',
      icon: <Icon.FileAddOutlined />,
      shortcut: [{ keybindings: [{ key: '⌘' }, { key: 'N' }] }],
      group: 'File',
      onSelect: () => {
        console.log('Creating new file...');
      },
    },
    {
      id: 'open-file',
      label: 'Open File',
      description: 'Open an existing file',
      icon: <Icon.FolderOpenOutlined />,
      shortcut: [{ keybindings: [{ key: '⌘' }, { key: 'O' }] }],
      group: 'File',
      onSelect: () => {
        console.log('Opening file...');
      },
    },
    {
      id: 'save-file',
      label: 'Save File',
      description: 'Save the current file',
      icon: <Icon.SaveOutlined />,
      shortcut: [{ keybindings: [{ key: '⌘' }, { key: 'S' }] }],
      group: 'File',
      onSelect: () => {
        console.log('Saving file...');
      },
    },
    {
      id: 'copy',
      label: 'Copy',
      description: 'Copy selected content',
      icon: <Icon.CopyOutlined />,
      shortcut: [{ keybindings: [{ key: '⌘' }, { key: 'C' }] }],
      group: 'Edit',
      onSelect: () => {
        console.log('Copying content...');
      },
    },
    {
      id: 'cut',
      label: 'Cut',
      description: 'Cut selected content',
      icon: <Icon.ScissorOutlined />,
      shortcut: [{ keybindings: [{ key: '⌘' }, { key: 'X' }] }],
      group: 'Edit',
      onSelect: () => {
        console.log('Cutting content...');
      },
    },
    {
      id: 'paste',
      label: 'Paste',
      description: 'Paste content from clipboard',
      shortcut: [{ keybindings: [{ key: '⌘' }, { key: 'V' }] }],
      group: 'Edit',
      onSelect: () => {
        console.log('Pasting content...');
      },
    },
    {
      id: 'find',
      label: 'Find',
      description: 'Find in current file',
      icon: <Icon.SearchOutlined />,
      shortcut: [{ keybindings: [{ key: '⌘' }, { key: 'F' }] }],
      group: 'Search',
      onSelect: () => {
        console.log('Finding content...');
      },
    },
    {
      id: 'show-commands',
      label: 'Show All Commands',
      description: 'Show all available commands',
      shortcut: [{ keybindings: [{ key: '⌘' }, { key: 'Shift' }, { key: 'P' }] }],
      group: 'View',
      onSelect: () => {
        console.log('Showing all commands...');
      },
    },
    {
      id: 'delete',
      label: 'Delete',
      description: 'Delete selected content',
      icon: <Icon.DeleteOutlined />,
      shortcut: [{ keybindings: [{ key: 'delete' }] }],
      group: 'Edit',
      onSelect: () => {
        console.log('Deleting content...');
      },
    },
    {
      id: 'find-replace',
      label: 'Find & Replace',
      description: 'Find and replace in file',
      icon: <Icon.FormOutlined />,
      shortcut: [{ keybindings: [{ key: '⌘' }, { key: 'R' }] }],
      group: 'Search',
      onSelect: () => {
        console.log('Finding and replacing...');
      },
    },
    {
      id: 'find-all',
      label: 'Find in All Files',
      description: 'Find in all files',
      icon: <Icon.SearchOutlined />,
      shortcut: [{ keybindings: [{ key: '⇧' }, { key: '⌘' }, { key: 'F' }] }],
      group: 'Search',
      onSelect: () => {
        console.log('Finding in all files...');
      },
    },
    {
      id: 'settings',
      label: 'Settings',
      description: 'Open application settings',
      icon: <Icon.SettingOutlined />,
      shortcut: [{ keybindings: [{ key: '⌘' }, { key: ',' }] }],
      group: 'Preferences',
      onSelect: () => {
        console.log('Opening settings...');
      },
    },
    {
      id: 'help',
      label: 'Help',
      description: 'Show help documentation',
      shortcut: [{ keybindings: [{ key: '⌘' }, { key: '?' }] }],
      group: 'Help',
      onSelect: () => {
        console.log('Opening help...');
      },
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <Button onClick={show} btnType="primary">
          Open Command Dialog
        </Button>
      </div>

      <CommandDialog
        open={open}
        onClose={hide}
        actions={actions}
        placeholder="Type a command or search..."
        emptyText="No commands found."
        onSelect={(action) => {
          console.log('Selected action:', action);
        }}
      />
    </div>
  );
};

export default BasicDemo;
