---
title: Button 按钮
nav:
  title: 组件
  order: 2
group:
  title: 反馈
  order: 1
---

# Button 按钮

按钮用于开始一个即时操作。

## 何时使用

标记了一个（或封装一组）操作命令，响应用户点击行为，触发相应的业务逻辑。

在 Zens 中我们提供了五种按钮类型：

- 主按钮：用于主行动点，一个操作区域只能有一个主按钮。
- 默认按钮：用于没有主次之分的一组行动点。
- 虚线按钮：常用于添加操作。
- 文本按钮：用于最次级的行动点。
- 链接按钮：用于作为外链的行动点。

以及四种状态属性：

- 危险：删除/移动/修改权限等危险操作，一般需要二次确认。
- 幽灵：用于背景色比较复杂的地方，常用在首页等展示场景。
- 禁用：行动点不可用的时候，一般需要文案解释。
- 加载中：用于异步操作等待反馈的时候，也可以避免多次提交。

## 代码演示

### 按钮类型

<code src="./demo/btnType.tsx"></code>

### 按钮尺寸和形状

<code src="./demo/basic.tsx"></code>

### 幽灵按钮

<code src="./demo/ghost.tsx"></code>

### 块级按钮

<code src="./demo/block.tsx"></code>

### 加载状态

<code src="./demo/loading.tsx"></code>

## API

| 属性 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| block | 将按钮宽度调整为其父宽度的选项 | boolean | false |
| btnType | 设置按钮类型 | `default` \| `primary` \| `dashed` \| `text` \| `link` | `default` |
| danger | 设置危险按钮 | boolean | false |
| disabled | 设置按钮失效状态 | boolean | false |
| ghost | 幽灵属性，使按钮背景透明 | boolean | false |
| loading | 设置按钮载入状态 | boolean \| { delay: number, icon: ReactNode } | false |
| shape | 设置按钮形状 | `default` \| `rect` | `default` |
| size | 设置按钮大小 | `large` \| `medium` \| `small` | `medium` |

支持原生 button 的其他所有属性。
