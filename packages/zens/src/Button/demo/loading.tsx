import { useState } from 'react';
import { Button, Space } from 'zens';
import { PoweroffOutlined } from '@ant-design/icons';

export default () => {
  const [loading1, setLoading1] = useState(true);
  const [loading2, setLoading2] = useState(true);
  const [loading3, setLoading3] = useState(true);

  return (
    <Space direction="vertical">
      {/* 基础 Loading 状态 */}
      <Space>
        <Button loading>默认加载</Button>
        <Button btnType="primary" loading>
          主要加载
        </Button>
        <Button btnType="dashed" loading>
          虚线加载
        </Button>
        <Button btnType="text" loading>
          文本加载
        </Button>
        <Button btnType="link" loading>
          链接加载
        </Button>
      </Space>

      {/* 不同尺寸的 Loading */}
      <Space>
        <Button size="small" loading>
          小按钮
        </Button>
        <Button size="medium" loading>
          中按钮
        </Button>
        <Button size="large" loading>
          大按钮
        </Button>
      </Space>

      {/* 危险按钮 Loading */}
      <Space>
        <Button danger loading>
          危险加载
        </Button>
        <Button btnType="primary" danger loading>
          危险主要加载
        </Button>
      </Space>

      {/* 幽灵按钮 Loading */}
      <Space
        style={{
          padding: '16px',
          background: '#f0f0f0',
        }}
      >
        <Button ghost loading>
          幽灵加载
        </Button>
        <Button btnType="primary" ghost loading>
          幽灵主要加载
        </Button>
        <Button danger ghost loading>
          幽灵危险加载
        </Button>
      </Space>

      {/* 块级按钮 Loading */}
      <Button block loading>
        块级加载按钮
      </Button>

      {/* 带延迟的 Loading */}
      <Space>
        <Button loading={{ delay: 1000 }}>延迟 1s 加载</Button>
        <Button loading={{ delay: 2000 }}>延迟 2s 加载</Button>
      </Space>

      {/* 自定义 Loading 图标 */}
      <Space>
        <Button
          loading={{ icon: <PoweroffOutlined spin /> }}
          btnType="primary"
        >
          自定义图标
        </Button>
      </Space>

      {/* 点击切换 Loading 状态 */}
      <Space>
        <Button
          loading={loading1}
          onClick={() => setLoading1(!loading1)}
          btnType="primary"
        >
          点击切换: {loading1 ? '加载中' : '加载完成'}
        </Button>
        <Button
          loading={loading2}
          onClick={() => setLoading2(!loading2)}
          danger
        >
          点击切换: {loading2 ? '加载中' : '加载完成'}
        </Button>
        <Button
          loading={loading3}
          onClick={() => setLoading3(!loading3)}
          btnType="dashed"
        >
          点击切换: {loading3 ? '加载中' : '加载完成'}
        </Button>
      </Space>
    </Space>
  );
};
