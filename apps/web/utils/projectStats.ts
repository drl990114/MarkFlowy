export type ProjectStats = {
  stars: number
  forks: number
  downloads: number
  checkedAt: string
}

const repository = 'https://api.github.com/repos/drl990114/MarkFlowy'
const packageFile = /\.(dmg|exe|msi|deb|rpm|appimage|zip|tar\.gz)$/i
const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0

// Verified against the repository and all 65 stable GitHub releases on 2026-09-21.
// Count installation/update packages only; exclude install.json and signatures.
export const projectStatsSnapshot: ProjectStats = {
  stars: 2393,
  forks: 93,
  downloads: 28848,
  checkedAt: '2026-09-21',
}

function countPackageDownloads(releases: unknown[]): number {
  return releases.reduce<number>((total, value) => {
    if (!value || typeof value !== 'object') throw new Error('Invalid release')
    const release = value as Record<string, unknown>
    if (release.draft === true || release.prerelease === true) return total
    if (release.draft !== false || release.prerelease !== false || !Array.isArray(release.assets)) {
      throw new Error('Invalid release metadata')
    }
    return release.assets.reduce<number>((downloads, assetValue: unknown) => {
      if (!assetValue || typeof assetValue !== 'object') throw new Error('Invalid release asset')
      const asset = assetValue as Record<string, unknown>
      if (typeof asset.name !== 'string') throw new Error('Invalid asset name')
      if (!packageFile.test(asset.name)) return downloads
      if (!isCount(asset.download_count)) throw new Error('Invalid download count')
      return downloads + asset.download_count
    }, total)
  }, 0)
}

/** Fetch only on the server through homepage ISR; never expose a GitHub token. */
export async function loadProjectStats(fetcher: typeof fetch = fetch): Promise<ProjectStats> {
  try {
    const options = {
      headers: { Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(5000),
    }
    const read = async (url: string): Promise<unknown> => {
      const response = await fetcher(url, options)
      if (!response.ok) throw new Error(`GitHub returned ${response.status}`)
      return response.json()
    }
    const loadDownloads = async () => {
      let downloads = 0
      // A bounded request budget avoids hanging ISR. Never publish a partial sum.
      for (let page = 1; page <= 20; page++) {
        const releases = await read(`${repository}/releases?per_page=100&page=${page}`)
        if (!Array.isArray(releases)) throw new Error('Invalid release list')
        downloads += countPackageDownloads(releases)
        if (releases.length < 100) return downloads
      }
      throw new Error('Release pagination exceeded the request budget')
    }
    const [repo, downloads] = await Promise.all([read(repository), loadDownloads()])
    if (!repo || typeof repo !== 'object') throw new Error('Invalid repository')
    const { stargazers_count: stars, forks_count: forks } = repo as Record<string, unknown>
    if (!isCount(stars) || !isCount(forks) || !isCount(downloads)) {
      throw new Error('Invalid project statistics')
    }
    return { stars, forks, downloads, checkedAt: new Date().toISOString() }
  } catch {
    // Keep the verified snapshot's original date instead of presenting stale data as live.
    return { ...projectStatsSnapshot }
  }
}
