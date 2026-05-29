import { Button, Space } from 'zens';

export default () => {
  return (
    <div style={{ padding: '16px' }}>
      <Space>
        <Button ghost>默认按钮</Button>
        <Button btnType='primary' ghost>主要按钮</Button>
        <Button btnType='dashed' ghost>虚线按钮</Button>
        <Button danger ghost>危险按钮</Button>
      </Space>
    </div>
  );
}
