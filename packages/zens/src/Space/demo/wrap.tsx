import { Button, Space } from 'zens';

export default () => (
  <Space size={[8, 16]} wrap>
    {Array.from({ length: 20 }, (_, index) => (
      <Button key={index}>按钮 {index + 1}</Button>
    ))}
  </Space>
);