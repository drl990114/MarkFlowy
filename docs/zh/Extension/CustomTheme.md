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

## 分享你的主题

完成主题开发后，你可以将主题分享给社区的其他用户：

### 提交到主题商店

如果你想让更多用户使用你的主题，可以将主题提交到 MarkFlowy 的官方主题商店：

1. **准备你的主题**
   - 确保主题功能完整且测试通过
   - 为主题仓库编写清晰的 README 文档
   - 发布到 npm 包管理器 [npm 包发布流程](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/)

2. **提交到社区主题列表**
   编辑项目根目录的 `community-themes.json` 文件，添加你的主题信息：

```json
{
  "name": "你的主题名称",
  "mode": ["dark", "light"],
  "description": "主题的简短描述",
  "packageName": "npm包名或GitHub仓库名",
  "author": "你的名字",
  "repository": "https://github.com/你的用户名/你的主题仓库"
}
```

3. **创建 Pull Request**
   将修改提交到主仓库，维护者审核通过后，你的主题就会出现在主题商店中。
