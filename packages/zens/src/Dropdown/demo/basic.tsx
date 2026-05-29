import { Dropdown } from 'zens';

import {
  AlignCenterOutlined,
  CheckSquareOutlined,
  CodeOutlined,
  DownOutlined,
  FormatPainterOutlined,
  OrderedListOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';

const toolbarItems = [
  { key: 'text', icon: <span style={{ fontWeight: 'bold' }}>T</span>, label: '文本' },
  { key: 'h1', icon: <span>H1</span>, label: '标题1' },
  { key: 'h2', icon: <span>H2</span>, label: '标题2', active: true },
  { key: 'h3', icon: <span>H3</span>, label: '标题3' },
  { key: 'h4', icon: <span>H4</span>, label: '标题4' },
  { key: 'h5', icon: <span>H5</span>, label: '标题5' },
  { key: 'h6', icon: <span>H6</span>, label: '标题6' },
  { type: 'divider' as const },
  { key: 'ol', icon: <OrderedListOutlined />, label: '有序列表' },
  { key: 'ul', icon: <UnorderedListOutlined />, label: '无序列表' },
  { key: 'checklist', icon: <CheckSquareOutlined />, label: '任务列表' },
  { key: 'quote', icon: <CodeOutlined />, label: '引用' },
  { key: 'code', icon: <CodeOutlined />, label: '代码块' },
  { key: 'align-center', icon: <AlignCenterOutlined />, label: '居中对齐' },
  { type: 'divider' as const },
  { key: 'code-block', icon: <CodeOutlined />, label: '代码块' },
  { key: 'brace', icon: <span>{ }</span>, label: '括号' },
];

const menuItems = [
  {
    key: 'color',
    label: '段落颜色',
    icon: <FormatPainterOutlined />,
  },
  {
    key: 'indent',
    label: '缩进和对齐',
    icon: <OrderedListOutlined />,
  },
];

export default () => {
  return (
    <Dropdown
      menu={{
        items: menuItems,
        toolbar: {
          items: toolbarItems,
          onClick: (item) => {
            console.log('toolbar click:', item);
          },
        },
        onClick: (item) => {
          console.log('menu click:', item);
        },
      }}
      trigger={['click']}
    >
      <span>
        格式化 <DownOutlined />
      </span>
    </Dropdown>
  );
};
