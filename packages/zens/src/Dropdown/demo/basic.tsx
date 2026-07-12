import { Dropdown } from 'zens';

const DemoIcon = ({ children }: { children: string }) => <span aria-hidden="true">{children}</span>;

const toolbarItems = [
  { key: 'text', icon: <span style={{ fontWeight: 'bold' }}>T</span>, label: '文本' },
  { key: 'h1', icon: <span>H1</span>, label: '标题1' },
  { key: 'h2', icon: <span>H2</span>, label: '标题2', active: true },
  { key: 'h3', icon: <span>H3</span>, label: '标题3' },
  { key: 'h4', icon: <span>H4</span>, label: '标题4' },
  { key: 'h5', icon: <span>H5</span>, label: '标题5' },
  { key: 'h6', icon: <span>H6</span>, label: '标题6' },
  { type: 'divider' as const },
  { key: 'ol', icon: <DemoIcon>1.</DemoIcon>, label: '有序列表' },
  { key: 'ul', icon: <DemoIcon>•</DemoIcon>, label: '无序列表' },
  { key: 'checklist', icon: <DemoIcon>☑</DemoIcon>, label: '任务列表' },
  { key: 'quote', icon: <DemoIcon>“</DemoIcon>, label: '引用' },
  { key: 'code', icon: <DemoIcon>&lt;/&gt;</DemoIcon>, label: '代码块' },
  { key: 'align-center', icon: <DemoIcon>≡</DemoIcon>, label: '居中对齐' },
  { type: 'divider' as const },
  { key: 'code-block', icon: <DemoIcon>{'{ }'}</DemoIcon>, label: '代码块' },
  { key: 'brace', icon: <span>{ }</span>, label: '括号' },
];

const menuItems = [
  {
    key: 'color',
    label: '段落颜色',
    icon: <DemoIcon>◐</DemoIcon>,
  },
  {
    key: 'indent',
    label: '缩进和对齐',
    icon: <DemoIcon>↹</DemoIcon>,
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
        格式化 <DemoIcon>▾</DemoIcon>
      </span>
    </Dropdown>
  );
};
