import { spawnSync } from 'node:child_process'
import { existsSync, realpathSync } from 'node:fs'
import { posix, win32 } from 'node:path'

export function resolveNpmCli({
  env = process.env,
  execPath = process.execPath,
  platform = process.platform,
  pathExists = existsSync,
  realPath = realpathSync,
} = {}) {
  const path = platform === 'win32' ? win32 : posix
  const candidates = []
  // npm sets this to its JS entry point; Yarn sets it to Yarn instead.
  if (env.npm_execpath && path.basename(env.npm_execpath) === 'npm-cli.js') {
    candidates.push(env.npm_execpath)
  }
  const pathKey = Object.keys(env).find((key) => key.toLowerCase() === 'path')
  const directories = [
    path.dirname(execPath),
    ...(env[pathKey] ?? '').split(path.delimiter).filter(Boolean),
  ]
  for (const directory of directories) {
    candidates.push(
      path.join(directory, 'node_modules/npm/bin/npm-cli.js'),
      path.resolve(directory, '../lib/node_modules/npm/bin/npm-cli.js'),
    )
    const executable = path.join(directory, platform === 'win32' ? 'npm.cmd' : 'npm')
    if (pathExists(executable)) {
      const resolved = realPath(executable)
      if (path.basename(resolved) === 'npm-cli.js') candidates.push(resolved)
    }
  }
  const cli = candidates.find(pathExists)
  if (!cli)
    throw new Error('Cannot find npm-cli.js. Install npm alongside Node.js or add npm to PATH.')
  return cli
}

export function runNpm(args, { cwd, env = process.env } = {}) {
  // Launch JavaScript directly: modern Node rejects .cmd with shell:false on
  // Windows, while shell:true would reinterpret paths and registry arguments.
  const result = spawnSync(process.execPath, [resolveNpmCli({ env }), ...args], {
    cwd,
    env,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || `npm exited ${result.status}`)
  }
  return result.stdout
}
