import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { appendFile, lstat, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import semver from 'semver'
import toml from 'toml'

export function releaseVersion(tag, tauriVersion, cargoVersion) {
  const version = tag?.slice(1)
  if (!tag?.startsWith('v') || semver.valid(version) !== version) {
    throw new Error(`Expected a canonical v-prefixed SemVer tag, received: ${tag}`)
  }
  if (version !== tauriVersion || version !== cargoVersion) {
    throw new Error(
      `Release tag ${tag} does not match Tauri ${tauriVersion} and Cargo ${cargoVersion}`,
    )
  }
  return { version, prerelease: semver.prerelease(version) !== null }
}

export function releaseNotes(changelog, tag) {
  const lines = changelog.split(/\r?\n/)
  const start = lines.findIndex((line) => line.trim() === `## ${tag}`)
  if (start < 0) throw new Error(`Missing release notes for ${tag}`)
  const next = lines.findIndex((line, index) => index > start && /^## /.test(line))
  const notes = lines
    .slice(start + 1, next < 0 ? undefined : next)
    .join('\n')
    .trim()
  if (!notes) throw new Error(`Empty release notes for ${tag}`)
  return notes
}

export function releaseArtifacts(version) {
  const prefix = `MarkFlowy_v${version}`
  const signed = [
    'MarkFlowy_aarch64.app.tar.gz',
    'MarkFlowy_x64.app.tar.gz',
    `${prefix}_amd64.AppImage`,
    `${prefix}_x64.msi`,
    `${prefix}_x64-setup.exe`,
    `${prefix}_offline_installer_x64.msi`,
    `${prefix}_offline_installer_x64-setup.exe`,
  ]
  return {
    signed,
    files: [
      ...signed.flatMap((file) => [file, `${file}.sig`]),
      `${prefix}_aarch64.dmg`,
      `${prefix}_x64.dmg`,
      `${prefix}_amd64.deb`,
      `MarkFlowy-${version}-1.x86_64.rpm`,
      `${prefix}_x64_portable.zip`,
    ].sort(),
    platforms: {
      'darwin-aarch64': signed[0],
      'darwin-aarch64-app': signed[0],
      'darwin-x86_64': signed[1],
      'darwin-x86_64-app': signed[1],
      'linux-x86_64': signed[2],
      'linux-x86_64-appimage': signed[2],
      'windows-x86_64': signed[3],
      'windows-x86_64-msi': signed[3],
      'windows-x86_64-nsis': signed[4],
      // Retain the original updater targets and Linux install script contract.
      darwin: signed[1],
      linux: signed[2],
      win64: signed[3],
    },
  }
}

export async function sha256(file) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(file)) hash.update(chunk)
  return hash.digest('hex')
}

function updaterSignature(source, name) {
  const signature = source.trim()
  const decoded = Buffer.from(signature, 'base64')
  const lines = decoded.toString('utf8').trim().split(/\r?\n/)
  // Check the Tauri/minisign envelope. Cryptographic verification remains the
  // updater client's responsibility; this prevents empty/error-page signatures.
  if (
    decoded.toString('base64') !== signature ||
    lines.length !== 4 ||
    !lines[0].startsWith('untrusted comment: ') ||
    Buffer.from(lines[1], 'base64').length !== 74 ||
    !lines[2].startsWith('trusted comment: ') ||
    Buffer.from(lines[3], 'base64').length !== 64
  ) {
    throw new Error(`Invalid Tauri signature envelope: ${name}`)
  }
  return signature
}

export async function prepareRelease({
  directory,
  tag,
  repository,
  tauriVersion,
  cargoVersion,
  notes,
  publishedAt = new Date().toISOString(),
}) {
  const { version, prerelease } = releaseVersion(tag, tauriVersion, cargoVersion)
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) throw new Error('Invalid GitHub repository')
  if (!notes?.trim()) throw new Error('Release notes are required')
  if (!Number.isFinite(Date.parse(publishedAt))) throw new Error('Invalid publication date')
  const { files, signed, platforms } = releaseArtifacts(version)
  const hashes = {}
  for (const file of files) {
    const artifact = path.join(directory, file)
    const info = await lstat(artifact)
    if (!info.isFile() || info.size === 0)
      throw new Error(`Missing or empty release artifact: ${file}`)
    hashes[file] = await sha256(artifact)
  }
  const signatures = {}
  for (const file of signed) {
    signatures[file] = updaterSignature(
      await readFile(path.join(directory, `${file}.sig`), 'utf8'),
      file,
    )
  }
  const base = `https://github.com/${repository}/releases/download/${encodeURIComponent(tag)}`
  const manifest = {
    version,
    notes,
    pub_date: new Date(publishedAt).toISOString(),
    platforms: Object.fromEntries(
      Object.entries(platforms).map(([platform, file]) => [
        platform,
        { signature: signatures[file], url: `${base}/${encodeURIComponent(file)}` },
      ]),
    ),
  }
  await writeFile(path.join(directory, 'install.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  hashes['install.json'] = await sha256(path.join(directory, 'install.json'))
  const checksums = Object.entries(hashes)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([file, hash]) => `${hash}  ${file}\n`)
    .join('')
  await writeFile(path.join(directory, 'SHA256SUMS'), checksums)
  return { version, prerelease, manifest, hashes }
}

async function main() {
  const { values } = parseArgs({
    options: {
      tag: { type: 'string', default: process.env.GITHUB_REF_NAME },
      repository: { type: 'string', default: process.env.GITHUB_REPOSITORY },
      artifacts: { type: 'string', default: 'artifacts' },
      faq: { type: 'string' },
    },
  })
  const root = fileURLToPath(new URL('..', import.meta.url))
  const config = JSON.parse(
    await readFile(path.join(root, 'apps/desktop/src-tauri/tauri.conf.json'), 'utf8'),
  )
  const cargo = toml.parse(
    await readFile(path.join(root, 'apps/desktop/src-tauri/Cargo.toml'), 'utf8'),
  )
  const notes = releaseNotes(
    await readFile(path.join(root, 'apps/desktop/UPDATE_LOG.md'), 'utf8'),
    values.tag,
  )
  const result = await prepareRelease({
    directory: path.resolve(values.artifacts),
    tag: values.tag,
    repository: values.repository,
    tauriVersion: config.version,
    cargoVersion: cargo.package.version,
    notes,
  })
  const faq = values.faq ? await readFile(values.faq, 'utf8') : ''
  await writeFile('release-notes.md', `${notes}\n\n${faq}`)
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, `prerelease=${result.prerelease}\n`)
  }
  console.log(
    `Prepared ${values.tag}: ${Object.keys(result.hashes).length} assets; prerelease=${result.prerelease}`,
  )
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
