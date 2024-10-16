const { withContentlayer } = require('next-contentlayer')
const { i18n } = require('./next-i18next.config.js')
const withSvgr = require('@newhighsco/next-plugin-svgr')

/**
 * @type {import('next').NextConfig}
 */

module.exports = withSvgr(
  withContentlayer({
    compiler: {
      styledComponents: true,
      styledJsx: true
    },
    i18n,
    experimental: {
      output: 'standalone',
    },
  }),
)
