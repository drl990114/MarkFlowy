import React, { useCallback, useState } from 'react';
import { Button, CommandAction, CommandDialog } from 'zens';


const SimpleDemo: React.FC = () => {
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
      shortcut: [{ keybindings: [{ key: '⌘' }, { key: 'N' }] }],
      group: 'File',
      onSelect: () => {
        console.log('Creating new file...');
        alert('New file created!');
      },
    },
    {
      id: 'open-file',
      label: 'Open File',
      description: 'Open an existing file',
      shortcut: [{ keybindings: [{ key: '⌘' }, { key: 'O' }] }],
      group: 'File',
      onSelect: () => {
        console.log('Opening file...');
        alert('File dialog opened!');
      },
    },
    {
      id: 'save-file',
      label: 'Save File',
      description: 'Save the current file',
      shortcut: [{ keybindings: [{ key: '⌘' }, { key: 'S' }] }],
      group: 'File',
      onSelect: () => {
        console.log('Saving file...');
        alert('File saved!');
      },
    },
    {
      id: 'copy',
      label: 'Copy',
      description: 'Copy selected text',
      shortcut: [{ keybindings: [{ key: '⌘' }, { key: 'C' }] }],
      group: 'Edit',
      onSelect: () => {
        console.log('Copying...');
        alert('Text copied!');
      },
    },
    {
      id: 'paste',
      label: 'Paste',
      description: 'Paste from clipboard',
      shortcut: [{ keybindings: [{ key: '⌘' }, { key: 'V' }] }],
      group: 'Edit',
      onSelect: () => {
        console.log('Pasting...');
        alert('Text pasted!');
      },
    },
    {
      id: 'find',
      label: 'Find',
      description: 'Search in current document',
      shortcut: [{ keybindings: [{ key: '⌘' }, { key: 'F' }] }],
      group: 'View',
      onSelect: () => {
        console.log('Opening search...');
        alert('Search opened!');
      },
    },
    {
      id: 'disabled-action',
      label: 'Disabled Action',
      description: 'This action is disabled',
      disabled: true,
      group: 'Other',
      onSelect: () => {
        console.log('This should not execute');
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

export default SimpleDemo;
