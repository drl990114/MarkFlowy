import { defineConfig } from 'dumi';

let base: string | undefined;
let publicPath: string | undefined;

// Github Pages 部署时需要更换为自己的仓库名
if (process.env.NODE_ENV === 'production' && process.env.PREVIEW !== '1') {
  console.log('production')
  base = '/zens/';
  publicPath = '/zens/';
}

export default defineConfig({
  base,
  publicPath,
  favicons: ['/favicon.ico'],
  title: 'zens',
  outputPath: 'doc-site',
  resolve: {
    docDirs: ['docs'],
    atomDirs: [{ type: 'component', dir: 'src' }],
  },
  themeConfig: {
    logo: (publicPath || '') + '/logo.png',
    lastUpdated: true,
    socialLinks: {
      github: 'https://github.com/drl990114/zens',
    },
    footer: 'Open-source MIT Licensed | Copyright © 2024  <a href="https://github.com/drl990114">@drl990114</a>'
  },
  exportStatic: {},
  forkTSChecker: {},
  extraBabelPlugins: [

  ],
});
