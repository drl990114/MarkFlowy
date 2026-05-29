import { Button, Space } from 'zens';

export default () => {
  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Button block>默认按钮</Button>
      <Button btnType='primary' block>主要按钮</Button>
      <Button btnType='dashed' block>虚线按钮</Button>
      <Button btnType='text' block>文本按钮</Button>
      <Button btnType='link' block>链接按钮</Button>
    </Space>
  );
}