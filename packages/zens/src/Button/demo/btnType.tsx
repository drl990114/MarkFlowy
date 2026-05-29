import { Button, Space } from 'zens';

export default () => {
  return (
    <Space direction="vertical">
      <Space>
        <Button>默认按钮</Button>
        <Button btnType='primary'>主要按钮</Button>
        <Button btnType='dashed'>虚线按钮</Button>
        <Button btnType='text'>文本按钮</Button>
        <Button btnType='link'>链接按钮</Button>
      </Space>
      
      <Space>
        <Button danger>危险按钮</Button>
        <Button btnType='primary' danger>危险主要按钮</Button>
        <Button btnType='dashed' danger>危险虚线按钮</Button>
        <Button btnType='text' danger>危险文本按钮</Button>
        <Button btnType='link' danger>危险链接按钮</Button>
      </Space>
    </Space>
  );
}
