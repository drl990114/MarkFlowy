import { DownOutlined, UserOutlined } from '@ant-design/icons';
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
      <Dropdown menu={{ items }} placement="bottomLeft" arrow>
        <span>bottomLeft</span>
      </Dropdown>
      <Dropdown menu={{ items }} placement="bottomCenter" arrow>
        <span>bottomCenter</span>
      </Dropdown>
      <Dropdown menu={{ items }} placement="bottomRight" arrow>
        <span>bottomRight</span>
      </Dropdown>
      <br />
      <Dropdown menu={{ items }} placement="topLeft" arrow>
        <span>topLeft</span>
      </Dropdown>
      <Dropdown menu={{ items }} placement="topCenter" arrow>
        <span>topCenter</span>
      </Dropdown>
      <Dropdown menu={{ items }} placement="topRight" arrow>
        <span>topRight</span>
      </Dropdown>
    </Space>
  );
};
