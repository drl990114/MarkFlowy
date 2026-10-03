import type { Endpoints } from '@octokit/types'

type Releases = Endpoints['GET /repos/{owner}/{repo}/releases']['response']['data']
const CACHE_DURATION = 60 * 60 * 1000 * 24
const releasesCache: Record<string, { data: Releases; ts: number }> = {}

export const getReleases = async (repo = 'MarkFlowy'): Promise<Releases> => {
  const now = Date.now()
  const isBrowser = typeof window !== 'undefined'
  let cached = releasesCache[repo]
  if (isBrowser) {
    try {
      cached = JSON.parse(localStorage.getItem(`releasesCache_${repo}`) || 'null')
    } catch {
      // Storage may be unavailable; the release request can still succeed.
    }
  }
  if (cached && Array.isArray(cached.data) && now - cached.ts < CACHE_DURATION) {
    return cached.data
  }

  const response = await fetch(
    `https://api.github.com/repos/drl990114/${repo}/releases?per_page=100`,
    {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: 'application/vnd.github+json' },
    },
  )
  if (!response.ok) throw new Error(`GitHub releases request failed (${response.status})`)
  const data: unknown = await response.json()
  if (!Array.isArray(data)) throw new Error('GitHub releases response is not a list')
  const entry = { data: data as Releases, ts: now }
  // Cache only successful lists, so a transient API error does not hide releases for a day.
  if (isBrowser) {
    try {
      localStorage.setItem(`releasesCache_${repo}`, JSON.stringify(entry))
    } catch {
      // Quota or privacy settings must not prevent reading release notes.
    }
  } else {
    releasesCache[repo] = entry
  }
  return entry.data
}
