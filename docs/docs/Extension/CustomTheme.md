# Custom Theme

MarkFlowy supports custom themes, and you can also share your themes with others.

## Develop Environment

- nodejs >= 16.x
- pnpm >= 7.x

## How to make a theme

### 1. Create theme files

You can fork [MarkFlowy-Theme-Template](https://github.com/markflowy-app/custom-theme-template) to create your theme.

```bash
pnpm install

pnpm run dev
```

### 2. Edit theme files

Open MarkFlowy, click `Settings`, you can see `path`, Open this path folder, create `extensions` folder in `.markflowy` folder, and then create your theme folder in `extensions` folder, e.g. `markflowy-theme-template`.

You can edit `rollup.config.js` to change the theme build files output.


```js
output: {
  // change this output file to development
  // e.g. file: '/Users/xxx/.markflowy/extensions/markflowy-theme-template/index.js',
  file: pkg.browser,
  format: 'es',
  sourcemap: true,
  entryFileNames: '[name].js',
},
```

change your theme, reload MarkFlowy to see the effect.




