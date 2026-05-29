---
nav:
  title: 快速上手
  order: 1
---

# 快速上手

## 安装

**使用 npm 或 yarn 安装**

```shell
npm install zens
```

```shell
yarn add zens
```

## 示例

```js
import Button from 'zens/es/Button'; // 手动按需加载 js

ReactDOM.render(<Button>按钮</Button>, mountNode);
```

### 自动按需加载

使用 [babel-plugin-import ](https://www.npmjs.com/package/babel-plugin-import) 优化引入方式，如下：

```js
import { Button } from 'zens'; // 与上述示例等价

ReactDOM.render(<Button>按钮</Button>, mountNode);
```

安装 `babel-plugin-import`

```
yarn add babel-plugin-import --dev
```

配置`.babelrc` 或 `babel-loader`

```json
{
  "plugins": [
    [
      "import",
      {
        "libraryName": "zens",
        "libraryDirectory": "esm" // default: lib
      }
    ]
  ]
}
```
