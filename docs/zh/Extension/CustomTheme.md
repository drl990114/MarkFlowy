# 自定义主题

MarkFlowy 支持自定义主题，你还可以与他人分享你的主题。

## 开发环境

- MarkFlowy > 0.7.0
- nodejs >= 18.x
- pnpm >= 7.x

## 如何制作主题

### 1. 创建主题文件

你可以 fork [MarkFlowy-Theme-Template](https://github.com/MarkFlowy/custom-theme-template) 来创建你的主题。

```bash
pnpm install

pnpm run dev
```

### 2. 编辑主题文件

打开 MarkFlowy，点击 `设置`，你可以看到 `路径`，打开这个路径文件夹，在 `.markflowy` 文件夹中创建 `themes` 文件夹，然后在 `themes` 文件夹中创建你的主题文件夹，例如 `markflowy-theme-template`。

你可以编辑 `rollup.config.js` 来更改主题构建文件的输出。

```js
output: {
  // 将此输出文件更改为开发环境
  // 例如 file: '/Users/xxx/.markflowy/themes/markflowy-theme-template/index.js',
  file: pkg.browser,
  format: 'es',
  sourcemap: true,
  entryFileNames: '[name].js',
},
```

更改你的主题后，重新加载 MarkFlowy 即可看到效果。
