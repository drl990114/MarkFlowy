---
title: Input 输入框
nav:
  title: 组件
  order: 2
group:
  title: 反馈
  order: 1
---

# Input 输入框

输入框组件，支持多种尺寸和状态。

## 基本用法

<code src="./demo/basic.tsx"></code>

## 不同尺寸

Input 组件支持三种尺寸：`small`、`medium`（默认）、`large`。

<code src="./demo/size.tsx"></code>

## API

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| size | 输入框尺寸 | `'small' \| 'medium' \| 'large'` | `'medium'` |
| onPressEnter | 按下回车键时的回调 | `(e: KeyboardEvent) => void` | - |
| inputRef | 输入框的 ref | `React.Ref<HTMLInputElement>` | - |

除了以上属性，Input 组件还支持所有原生 `input` 元素的属性，如 `placeholder`、`disabled`、`readOnly` 等。

## 状态

- **正常状态**: 默认样式
- **悬停状态**: 鼠标悬停时边框变为主题色
- **聚焦状态**: 获得焦点时显示主题色边框和阴影
- **禁用状态**: 设置 `disabled` 属性
- **只读状态**: 设置 `readOnly` 属性
- **错误状态**: 设置 `data-error="true"` 属性
