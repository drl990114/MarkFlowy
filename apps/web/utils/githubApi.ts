import { Endpoints } from '@octokit/types';
import 'isomorphic-fetch';

const CACHE_DURATION = 60 * 60 * 1000 * 24 // 24 hours

let releasesCache: {
  [repo: string]: { data: any; ts: number }
} = {}

export const getReleases = async (
  repo = 'MarkFlowy'
): Promise<Endpoints['GET /repos/{owner}/{repo}/releases']['response']['data']> => {
  const now = Date.now()
  const isBrowser = typeof window !== 'undefined'

  console.log('Fetching releases for repo:', repo, isBrowser)
  if (isBrowser) {
    const cacheStr = localStorage.getItem(`releasesCache_${repo}`)
    if (cacheStr) {
      try {
        const cache = JSON.parse(cacheStr)
        if (now - cache.ts < CACHE_DURATION) {
          return cache.data
        }
      } catch {}
    }
    const resp = await fetch(`https://api.github.com/repos/drl990114/${repo}/releases?per_page=999`)
    const data = await resp.json()
    localStorage.setItem(`releasesCache_${repo}`, JSON.stringify({ data, ts: now }))
    return data
  } else {
    const cache = releasesCache[repo]
    if (cache && now - cache.ts < CACHE_DURATION) {
      return cache.data
    }
    const resp = await fetch(`https://api.github.com/repos/drl990114/${repo}/releases?per_page=999`)
    const data = await resp.json()
    releasesCache[repo] = { data, ts: now }
    return data
  }
}
