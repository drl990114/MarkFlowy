import { useState } from 'react';
import { Button, Space, SpaceSize } from 'zens';

export default () => {
  const [size, setSize] = useState<SpaceSize>('small' as const);

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <label>
          <input
            type="radio"
            value="small"
            checked={size === 'small'}
            onChange={() => setSize('small')}
          /> 小
        </label>
        <label style={{ marginLeft: '8px' }}>
          <input
            type="radio"
            value="middle"
            checked={size === 'middle'}
            onChange={() => setSize('middle')}
          /> 中
        </label>
        <label style={{ marginLeft: '8px' }}>
          <input
            type="radio"
            value="large"
            checked={size === 'large'}
            onChange={() => setSize('large')}
          /> 大
        </label>
      </div>
      <Space size={size}>
        <Button>按钮1</Button>
        <Button>按钮2</Button>
        <Button>按钮3</Button>
      </Space>
    </div>
  );
};
