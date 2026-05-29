import { useState } from 'react';
import { Dropdown, type DropdownMenuItem, type MenuItemType } from 'zens';
import {
  DownOutlined,
  FileOutlined,
  FolderOutlined,
  EditOutlined,
  DeleteOutlined,
  ShareAltOutlined,
  DownloadOutlined,
} from '@ant-design/icons';

/**
 * 嵌套子菜单示例
 * 展示 Dropdown 如何支持 children 子菜单
 */
export default () => {
  const [selected, setSelected] = useState<string>('');

  const menuItems: DropdownMenuItem[] = [
    {
      key: 'file',
      label: '文件',
      icon: <FileOutlined />,
      children: [
        {
          key: 'new',
          label: '新建',
          icon: <FileOutlined />,
          children: [
            { key: 'new-file', label: '新建文件' },
            { key: 'new-folder', label: '新建文件夹' },
            { key: 'new-project', label: '新建项目' },
          ],
        },
        {
          key: 'open',
          label: '打开',
          icon: <FolderOutlined />,
          children: [
            { key: 'open-recent', label: '最近打开' },
            { key: 'open-folder', label: '打开文件夹' },
          ],
        },
        { type: 'divider' },
        { key: 'save', label: '保存' },
        { key: 'save-as', label: '另存为' },
      ],
    },
    {
      key: 'edit',
      label: '编辑',
      icon: <EditOutlined />,
      children: [
        { key: 'cut', label: '剪切' },
        { key: 'copy', label: '复制' },
        { key: 'paste', label: '粘贴' },
        { type: 'divider' },
        {
          key: 'find',
          label: '查找',
          children: [
            { key: 'find', label: '查找...' },
            { key: 'replace', label: '替换...' },
          ],
        },
      ],
    },
    { type: 'divider' },
    {
      key: 'share',
      label: '分享',
      icon: <ShareAltOutlined />,
      children: [
        { key: 'share-link', label: '复制链接' },
        { key: 'share-email', label: '邮件分享' },
      ],
    },
    {
      key: 'download',
      label: '下载',
      icon: <DownloadOutlined />,
    },
    { type: 'divider' },
    {
      key: 'delete',
      label: '删除',
      icon: <DeleteOutlined />,
      danger: true,
    },
  ];

  const handleMenuClick = (item: MenuItemType) => {
    setSelected(item.key);
    console.log('Selected:', item.key);
  };

  return (
    <div style={{ padding: 24 }}>
      <h3>嵌套子菜单示例</h3>
      <p>Dropdown 支持多级嵌套子菜单，通过 children 属性配置。</p>

      <Dropdown
        menu={{
          items: menuItems,
          onClick: handleMenuClick,
        }}
        trigger={['click']}
        placement="bottomLeft"
      >
        <span style={{ cursor: 'pointer', color: '#1890ff' }}>
          点击打开菜单 <DownOutlined />
        </span>
      </Dropdown>

      {selected && (
        <div style={{ marginTop: 24, padding: 12, background: '#f6ffed', borderRadius: 4 }}>
          你选择了: <strong>{selected}</strong>
        </div>
      )}
    </div>
  );
};
