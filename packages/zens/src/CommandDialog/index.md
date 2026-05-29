# CommandDialog 命令弹窗

## 基础用法

<code src="./demo/simple.tsx"></code>

## 带图标和快捷键

<code src="./demo/basic.tsx"></code>

## API

### CommandDialog

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| actions | 命令列表 | `CommandAction[]` | `[]` |
| placeholder | 搜索框占位符 | `string` | `'Type a command or search...'` |
| emptyText | 无结果时显示的文本 | `string` | `'No results found.'` |
| filter | 自定义过滤函数 | `(actions: CommandAction[], search: string) => CommandAction[]` | - |
| onSelect | 选择命令时的回调 | `(action: CommandAction) => void` | - |
| onClose | 关闭弹窗时的回调 | `() => void` | - |
| containerClass | 容器自定义类名 | `string` | - |
| width | 弹窗宽度 | `string` | `'640px'` |
| maxHeight | 列表最大高度 | `string` | `'400px'` |

继承 Ariakit Dialog 的所有属性（除了 `children` 和 `onSelect`）。

### CommandAction

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| id | 唯一标识符 | `string` | - |
| label | 显示文本 | `string` | - |
| description | 描述或副标题 | `string` | - |
| icon | 图标组件 | `React.ReactNode` | - |
| shortcut | 快捷键显示 | `{ label: string; icon?: React.ReactNode }[]` | - |
| group | 分组名称 | `string` | - |
| disabled | 是否禁用 | `boolean` | `false` |
| onSelect | 选择时的回调 | `() => void` | - |

## 注意事项

1. CommandDialog 基于 Ariakit Dialog 实现，具有完整的无障碍支持
2. 键盘导航使用方向键进行选择，Enter 键确认选择
3. 支持 Escape 键关闭弹窗
4. 搜索是实时的，会根据输入内容过滤显示的命令
5. 分组会自动添加分隔线，`default` 分组不显示标题
