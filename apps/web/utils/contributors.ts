export type Contributor = { id: number; login: string; avatar_url: string; html_url: string }

const botIds = new Set([49699333, 29139614, 41898282, 29791463])
const profile = (id: number, login: string): Contributor => ({
  id,
  login,
  avatar_url: `https://avatars.githubusercontent.com/u/${id}?s=96&v=4`,
  html_url: `https://github.com/${login}`,
})

// Public GitHub contributors snapshot, verified 2026-09-21. Keep the community
// visible when GitHub is unavailable or rate-limited; ISR refreshes the live list.
// Source: https://api.github.com/repos/drl990114/MarkFlowy/contributors?per_page=100
export const contributorSnapshot: Contributor[] = [
  profile(48054715, 'drl990114'),
  profile(99468824, 'KiraKiraAyu'),
  profile(20470033, 'codeErrorSleep'),
  profile(110803307, 'hobostay'),
  profile(163967164, 'AdySnowflake'),
  profile(144215270, 'SamDc73'),
  profile(3081432, 'jing2uo'),
  profile(3076449, 'marianoesteban'),
  profile(83693755, 'Raven-1027'),
  profile(3613462, 'andriishin'),
  profile(106591791, 'chiefass'),
  profile(12391, 'dai'),
  profile(54581644, 'hope-zjl'),
  profile(59349105, 'punkyard'),
]

export function normalizeContributors(data: unknown): Contributor[] {
  if (!Array.isArray(data)) return []
  const seen = new Set<number>()
  return data
    .flatMap((value: unknown) => {
      if (!value || typeof value !== 'object') return []
      const { id, login, type } = value as Record<string, unknown>
      if (
        typeof id !== 'number' ||
        !Number.isSafeInteger(id) ||
        id <= 0 ||
        typeof login !== 'string' ||
        !/^[a-z\d-]+$/i.test(login) ||
        type === 'Bot' ||
        botIds.has(id) ||
        seen.has(id)
      )
        return []
      seen.add(id)
      return [profile(id, login)]
    })
    .slice(0, 36)
}

export async function loadContributors(fetcher: typeof fetch = fetch): Promise<Contributor[]> {
  try {
    const response = await fetcher(
      'https://api.github.com/repos/drl990114/MarkFlowy/contributors?per_page=100',
      {
        headers: { Accept: 'application/vnd.github+json' },
        signal: AbortSignal.timeout(3000),
      },
    )
    if (response.ok) {
      const contributors = normalizeContributors(await response.json())
      if (contributors.length) return contributors
    }
  } catch {
    // A network failure must not replace real people with an empty placeholder.
  }
  return contributorSnapshot
}
