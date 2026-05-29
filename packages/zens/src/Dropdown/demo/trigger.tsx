import { Dropdown, Space } from 'zens';

const items = [
  {
    key: '1',
    label: '1st menu item',
  },
  {
    key: '2',
    label: '2nd menu item',
  },
  {
    key: '3',
    label: '3rd menu item',
  },
];

export default () => {
  return (
    <Space>
      <Dropdown menu={{ items }} trigger={['click']}>
        <span>Click me</span>
      </Dropdown>
      <Dropdown menu={{ items }} trigger={['hover']}>
        <span>Hover me</span>
      </Dropdown>
      <Dropdown menu={{ items }} trigger={['contextMenu']}>
        <span>Right click me</span>
      </Dropdown>
    </Space>
  );
};
