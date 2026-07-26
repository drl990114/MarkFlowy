const { withContentlayer } = require('next-contentlayer2')
const { i18n } = require('./next-i18next.config.js')
const withSvgr = require('@newhighsco/next-plugin-svgr')

const LOCAL_CLOUD_API_URL = 'http://localhost:8787'

function getCloudApiUrl() {
  const configuredUrl =
    process.env.MARKFLOWY_CLOUD_API_URL?.trim() ||
    // Backward compatibility for existing deployments. The browser no longer reads this value.
    process.env.NEXT_PUBLIC_API_URL?.trim()

  if (!configuredUrl) {
    if (process.env.NODE_ENV === 'development') {
      return LOCAL_CLOUD_API_URL
    }

    throw new Error('MARKFLOWY_CLOUD_API_URL is required outside development')
  }

  const url = new URL(configuredUrl)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('MARKFLOWY_CLOUD_API_URL must use http or https')
  }

  return configuredUrl.replace(/\/+$/, '')
}

module.exports = withSvgr(
  withContentlayer({
    compiler: {
      styledComponents: true,
      styledJsx: true,
    },
    i18n: { ...i18n },
    output: 'standalone',
    transpilePackages: ['@markflowy/interface', 'zens'],
    turbopack: {},
    async rewrites() {
      return [
        {
          source: '/api/cloud/:path*',
          destination: `${getCloudApiUrl()}/:path*`,
        },
      ]
    },
    async headers() {
      return [
        {
          source: '/api/cloud/:path*',
          headers: [
            {
              key: 'Cache-Control',
              value: 'private, no-store',
            },
            {
              key: 'X-Vercel-Enable-Rewrite-Caching',
              value: '0',
            },
          ],
        },
      ]
    },
  }),
)
