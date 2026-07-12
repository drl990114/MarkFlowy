import { Button, Space } from 'zens';

export default () => {
  return (
    <Space direction="vertical">
      <Space>
        <Button size='small'>小按钮</Button>
        <Button>默认按钮</Button>
        <Button size='large'>大按钮</Button>
      </Space>

      <Space>
        <Button shape="default">默认形状</Button>
        <Button shape="rect">直角按钮</Button>
      </Space>
    </Space>
  );
}
