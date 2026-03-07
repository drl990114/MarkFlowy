# Custom Theme

MarkFlowy supports custom themes, and you can also share your themes with others.

## Develop Environment

- MarkFlowy > 0.7.0
- nodejs >= 18.x
- pnpm >= 7.x

## How to make a theme

### 1. Create theme files

You can fork [MarkFlowy-Theme-Template](https://github.com/MarkFlowy/custom-theme-template) to create your theme.

```bash
pnpm install

pnpm run dev
```

### 2. Edit theme files

Open MarkFlowy, click `Settings`, you can see `path`, Open this path folder, create `themes` folder in `.markflowy` folder, and then create your theme folder in `themes` folder, e.g. `markflowy-theme-template`.

You can edit `rollup.config.js` to change the theme build files output.


```js
output: {
  // change this output file to development
  // e.g. file: '/Users/xxx/.markflowy/themes/markflowy-theme-template/index.js',
  file: pkg.browser,
  format: 'es',
  sourcemap: true,
  entryFileNames: '[name].js',
},
```

change your theme, reload MarkFlowy to see the effect.

## Share your theme

After completing theme development, you can share your theme with other users in the community:

### Submit to Theme Store

If you want more users to use your theme, you can submit it to MarkFlowy's official theme store:

1. **Prepare your theme**
   - Ensure the theme is fully functional and tested
   - Write a clear README document for the theme repository
   - Publish to npm package manager [npm package publishing process](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/)
   - Create a release on GitHub

2. **Submit to community theme list**
   Edit the `community-themes.json` file in the project root directory and add your theme information:

```json
{
  "name": "Your Theme Name",
  "mode": ["dark", "light"],
  "description": "Brief description of the theme",
  "packageName": "npm package name or GitHub repository name",
  "author": "Your name",
  "repository": "https://github.com/your-username/your-theme-repository"
}
```

3. **Create Pull Request**
   Submit the changes to the main repository. After review and approval by maintainers, your theme will appear in the theme store.




