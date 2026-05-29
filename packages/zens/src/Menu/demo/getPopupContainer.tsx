import { Menu, MenuItemData } from 'zens';
import { useRef } from 'react';
import styled from 'styled-components';

const Container = styled.div`
  position: relative;
  height: 300px;
  border: 1px dashed #d9d9d9;
  border-radius: 8px;
  padding: 20px;
  overflow: auto;
  background: #fafafa;
`;

const ScrollContent = styled.div`
  height: 600px;
  padding-top: 100px;
`;

export default () => {
  const containerRef = useRef<HTMLDivElement>(null);

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
    },
  ];

  return (
    <div>
      <p style={{ marginBottom: 16 }}>
        当页面有滚动容器时，可以使用 getPopupContainer 将菜单渲染到指定的容器中，
        避免菜单跟随滚动而移出可视区域。
      </p>
      <Container ref={containerRef}>
        <ScrollContent>
          <Menu 
            items={menuData}
            getPopupContainer={(triggerNode) => {
              return triggerNode.parentElement || document.body;
            }}
          >
            点击打开菜单
          </Menu>
        </ScrollContent>
      </Container>
    </div>
  );
};
