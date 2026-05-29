import { useRef, useState } from 'react';
import styled from 'styled-components';
import { Dropdown, type DropdownMenuItem, type MenuItemType } from 'zens';

/**
 * 模拟 BlockHandler 使用场景的 Demo
 * 展示如何使用 raw 模式处理 fixed 定位的元素
 */
const RawModeDemo = () => {
  const triggerRef = useRef<HTMLDivElement>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [position, setPosition] = useState({ left: 100, top: 100 });

  const menuItems: DropdownMenuItem[] = [
    {
      key: 'heading1',
      label: 'Heading 1',
      icon: <i className="ri-h-1" />,
    },
    {
      key: 'heading2',
      label: 'Heading 2',
      icon: <i className="ri-h-2" />,
    },
    {
      key: 'heading3',
      label: 'Heading 3',
      icon: <i className="ri-h-3" />,
    },
    { type: 'divider' },
    {
      key: 'paragraph',
      label: 'Paragraph',
      icon: <i className="ri-paragraph" />,
    },
    {
      key: 'list',
      label: 'List',
      icon: <i className="ri-list-check" />,
    },
    { type: 'divider' },
    {
      key: 'delete',
      label: 'Delete',
      icon: <i className="ri-delete-bin-line" />,
      danger: true,
    },
  ];

  const handleMenuClick = (item: MenuItemType) => {
    console.log('Selected:', item.key);
    setDropdownOpen(false);
  };

  // 模拟位置变化（如滚动时的位置更新）
  const handlePositionChange = () => {
    setPosition({
      left: Math.random() * 300 + 50,
      top: Math.random() * 300 + 50,
    });
  };

  return (
    <DemoContainer>
      <h3>Raw Mode Dropdown Demo (BlockHandler Style)</h3>
      <p>
        这个 demo 模拟了 BlockHandler 的使用场景：fixed 定位的触发元素，
        使用 raw 模式让 Dropdown 直接渲染 children 而不添加包裹元素。
      </p>

      <ControlPanel>
        <span>open: {dropdownOpen ? '1' : '0'}</span>
        <button onClick={handlePositionChange}>随机改变位置</button>
        <span>当前位置: left: {position.left}px, top: {position.top}px</span>
      </ControlPanel>

      <Dropdown
        raw
        triggerRef={triggerRef}
        open={dropdownOpen}
        onOpenChange={setDropdownOpen}
        trigger={['click']}
        placement="bottomLeft"
        getPopupContainer={() => document.body}
        menu={{
          items: menuItems,
          onClick: handleMenuClick,
        }}
      >
        <BlockHandlerContainer
          ref={triggerRef}
          onClick={() => setDropdownOpen(!dropdownOpen)}
          style={{
            position: 'fixed',
            left: `${position.left}px`,
            top: `${position.top}px`,
          }}
        >
          <IconButton>
            <i className="ri-paragraph" />
          </IconButton>
          <DragHandle>
            <i className="ri-draggable" />
          </DragHandle>
        </BlockHandlerContainer>
      </Dropdown>

      <InfoPanel>
        <h4>使用说明：</h4>
        <ul>
          <li>
            <code>raw</code> - 开启 raw 模式，Dropdown 不会包裹 children
          </li>
          <li>
            <code>triggerRef</code> - 传递触发元素的 ref，用于菜单定位
          </li>
          <li>
            事件处理（onClick）由使用者自行控制
          </li>
          <li>
            菜单会根据 triggerRef 的位置自动定位
          </li>
        </ul>
      </InfoPanel>
    </DemoContainer>
  );
};

const DemoContainer = styled.div`
  padding: 20px;
  min-height: 500px;
  position: relative;
`;

const ControlPanel = styled.div`
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 16px;

  button {
    padding: 8px 16px;
    background: #1890ff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;

    &:hover {
      background: #40a9ff;
    }
  }

  span {
    color: #666;
    font-size: 14px;
  }
`;

const BlockHandlerContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px 8px;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  font-size: 14px;
  z-index: 1000;
  background-color: white;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);

  &:hover {
    background-color: #f5f5f5;
    border-color: #1890ff;
  }
`;

const IconButton = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 24px;
  width: 24px;
  border-radius: 4px;
  cursor: pointer;
  color: #595959;

  &:hover {
    color: #1890ff;
  }
`;

const DragHandle = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 24px;
  width: 24px;
  border-radius: 4px;
  cursor: grab;
  color: #8c8c8c;
  margin-left: 4px;

  &:hover {
    background-color: #e6e6e6;
  }

  &:active {
    cursor: grabbing;
  }
`;

const InfoPanel = styled.div`
  margin-top: 40px;
  padding: 16px;
  background: #f6ffed;
  border: 1px solid #b7eb8f;
  border-radius: 8px;

  h4 {
    margin: 0 0 12px 0;
    color: #52c41a;
  }

  ul {
    margin: 0;
    padding-left: 20px;
  }

  li {
    margin: 8px 0;
    color: #595959;
    line-height: 1.6;
  }

  code {
    background: #fff;
    padding: 2px 6px;
    border-radius: 3px;
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
    font-size: 13px;
    color: #cf1322;
  }
`;

export default RawModeDemo;
