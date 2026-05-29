import { Dropdown } from 'zens';
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

const menuItems = [
  {
    key: 'edit',
    label: '编辑',
    icon: <i className="ri-edit-line" />,
  },
  {
    key: 'copy',
    label: '复制',
    icon: <i className="ri-file-copy-line" />,
  },
  {
    key: 'delete',
    label: '删除',
    icon: <i className="ri-delete-bin-line" />,
    danger: true,
  },
];

export default () => {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div>
      <p style={{ marginBottom: 16 }}>
        当页面有滚动容器时，可以使用 getPopupContainer 将下拉菜单渲染到指定的容器中，
        避免下拉菜单跟随滚动而移出可视区域。
      </p>
      <Container ref={containerRef}>
        <ScrollContent>
          <Dropdown
            menu={{
              items: menuItems,
              onClick: (item) => {
                console.log('menu click:', item);
              },
            }}
            trigger={['click']}
            getPopupContainer={(triggerNode) => {
              return triggerNode.parentElement || document.body;
            }}
          >
            <span style={{ cursor: 'pointer' }}>
              点击打开下拉菜单 ▼
            </span>
          </Dropdown>
        </ScrollContent>
      </Container>
    </div>
  );
};
