import { Button, Space } from 'zens';

export default () => (
  <div>
    <div style={{ marginBottom: '40px' }}>
      <Space align="start">
        <span>对齐方式: start</span>
        <Button>按钮</Button>
        <div style={{ padding: '20px', background: 'rgba(150, 150, 150, 0.2)' }}>Block</div>
      </Space>
    </div>
    <div style={{ marginBottom: '40px' }}>
      <Space align="center">
        <span>对齐方式: center</span>
        <Button>按钮</Button>
        <div style={{ padding: '20px', background: 'rgba(150, 150, 150, 0.2)' }}>Block</div>
      </Space>
    </div>
    <div style={{ marginBottom: '40px' }}>
      <Space align="end">
        <span>对齐方式: end</span>
        <Button>按钮</Button>
        <div style={{ padding: '20px', background: 'rgba(150, 150, 150, 0.2)' }}>Block</div>
      </Space>
    </div>
    <div>
      <Space align="baseline">
        <span>对齐方式: baseline</span>
        <Button>按钮</Button>
        <div style={{ padding: '20px', background: 'rgba(150, 150, 150, 0.2)' }}>Block</div>
      </Space>
    </div>
  </div>
);