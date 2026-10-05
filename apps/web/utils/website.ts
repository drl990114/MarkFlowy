export const PRODUCT_URL = 'https://github.com/drl990114/MarkFlowy'
export const DOWNLOAD_URL = `${PRODUCT_URL}/releases`
export const DEMO_URL = '/workspace/demo-workspace'

/** Public presentation pages own their theme; application and data routes do not. */
export function isWebsitePage(pathname: string): boolean {
  return (
    ['/', '/docs', '/releases', '/privacy', '/404', '/_error'].includes(pathname) ||
    pathname.startsWith('/docs/')
  )
}
