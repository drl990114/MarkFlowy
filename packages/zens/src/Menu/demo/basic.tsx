import { Menu, MenuItemData } from 'zens';

export default () => {
  const menuData: MenuItemData[] = [
    {
      label: '复制',
      value: 'copy',
      shortcut: '⌘C',
      handler: () => {
        console.log('复制');
      },
    },
    {
      label: '粘贴',
      value: 'paste',
      shortcut: '⌘V',
      handler: () => {
        console.log('粘贴');
      },
    },
    {
      type: 'divider',
    },
    {
      label: '编辑',
      value: 'edit',
      shortcut: '⌘E',
      children: [
        {
          label: '撤销',
          value: 'undo',
          shortcut: '⌘Z',
        },
        {
          label: '重做',
          value: 'redo',
          shortcut: '⇧⌘Z',
        },
      ],
    },
    {
      label: '查找',
      value: 'find',
      shortcut: '⌘F',
    }
  ];

  return (
    <Menu items={menuData}>
      actions
    </Menu>
  );
};
