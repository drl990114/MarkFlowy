import { appendFile, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { sha256 } from './release-artifacts.mjs'

export function verifyReleaseAssets({ release, assets, tag, hashes }) {
  if (release.tag_name !== tag || release.draft !== true) {
    throw new Error(`Refusing to publish: ${tag} is not a matching draft release`)
  }
  for (const [name, hash] of Object.entries(hashes)) {
    const matches = assets.filter((asset) => asset.name === name)
    if (
      matches.length !== 1 ||
      matches[0].state !== 'uploaded' ||
      matches[0].digest !== `sha256:${hash}`
    ) {
      throw new Error(`Uploaded release artifact is missing or has a different SHA-256: ${name}`)
    }
  }
  for (const asset of assets) {
    if (!Object.hasOwn(hashes, asset.name))
      throw new Error(`Unexpected release artifact: ${asset.name}`)
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      'ensure-draft': { type: 'boolean' },
      'stable-channel': { type: 'boolean' },
      artifacts: { type: 'string', default: 'artifacts' },
    },
  })
  const { GITHUB_REPOSITORY: repository, GITHUB_REF_NAME: tag, GH_TOKEN: token } = process.env
  if (!repository || !tag || !token)
    throw new Error('GitHub repository, tag and token are required')
  const base = `https://api.github.com/repos/${repository}`
  const request = async (endpoint, allowMissing = false) => {
    const response = await fetch(`${base}${endpoint}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      signal: AbortSignal.timeout(60_000),
    })
    if (allowMissing && response.status === 404) return null
    if (!response.ok) throw new Error(`GitHub release lookup failed: HTTP ${response.status}`)
    return response.json()
  }
  if (values['stable-channel']) {
    const latest = await request('/releases/latest')
    const current = latest.tag_name === tag && !latest.prerelease && !latest.draft
    if (process.env.GITHUB_OUTPUT)
      await appendFile(process.env.GITHUB_OUTPUT, `is_latest=${current}\n`)
    return
  }
  const release = await request(`/releases/tags/${encodeURIComponent(tag)}`, values['ensure-draft'])
  if (values['ensure-draft']) {
    if (release && !release.draft)
      throw new Error(`Refusing to modify the published release ${tag}`)
    return
  }
  const hashes = {}
  const checksums = await readFile(path.join(values.artifacts, 'SHA256SUMS'), 'utf8')
  for (const line of checksums.trim().split('\n')) {
    const match = /^([a-f0-9]{64}) {2}([^/\\]+)$/.exec(line)
    if (!match || Object.hasOwn(hashes, match[2])) throw new Error('Invalid SHA256SUMS')
    hashes[match[2]] = match[1]
  }
  hashes.SHA256SUMS = await sha256(path.join(values.artifacts, 'SHA256SUMS'))
  const assets = []
  for (let page = 1; ; page++) {
    const batch = await request(`/releases/${release.id}/assets?per_page=100&page=${page}`)
    assets.push(...batch)
    if (batch.length < 100) break
  }
  verifyReleaseAssets({ release, assets, tag, hashes })
  console.log(`Verified ${assets.length} uploaded release artifacts for ${tag}`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
