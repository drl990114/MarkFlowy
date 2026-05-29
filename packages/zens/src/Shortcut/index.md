---
title: Shortcut 快捷键
av:
  title: 组件
  order: 10
group:
  title: 通用
  order: 5
---

# Shortcut 快捷键

用于展示键盘快捷键组合的组件。

## 何时使用

- 需要在界面上直观地展示键盘快捷键操作时
- 在帮助文档、菜单或操作提示中显示快捷键
- 为用户提供操作指南和快捷方式提示

## 代码演示

### 基本使用

<code src="./demo/basic.tsx"></code>

## API

### ShortcutProps

| 属性 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| dataSource | 快捷键数据数组 | `Shortcut[]` | 无 |

### Shortcut 接口

| 属性 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| keybindings | 快捷键按键数组 | `{ key: React.ReactNode }[]` | 无 |
| icon | 可选的快捷键图标 | `React.ReactNode` | 无 |
| desc | 快捷键描述文本 | `string` | 无 |

## 注意事项

- 建议保持快捷键的简洁性，避免过于复杂的组合
- 对于 Mac 和 Windows 不同平台的快捷键，可以提供平台特定的展示
- 可以结合提示组件（如 Tooltip）使用，提供更详细的快捷键说明