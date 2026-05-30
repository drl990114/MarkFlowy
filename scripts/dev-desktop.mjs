import { execSync, spawn } from 'child_process'

const procs = []

const killPort = (port) => {
  try {
    execSync(`lsof -ti :${port} | xargs kill -TERM 2>/dev/null || true`, { stdio: 'ignore' })
  } catch {}
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const cleanup = () => {
  procs.forEach((p) => {
    try {
      p.kill('SIGTERM')
    } catch {}
  })
  process.exit(0)
}

process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)

killPort(3000)
killPort(3030)
await sleep(500)

const turboProc = spawn(
  'yarn',
  ['turbo', 'run', 'dev', '--filter=!@markflowy/desktop', '--filter=!@markflowy/web'],
  { stdio: 'inherit' },
)
procs.push(turboProc)

await sleep(8000)

const tauriProc = spawn('yarn', ['workspace', '@markflowy/desktop', 'tauri:dev'], {
  stdio: 'inherit',
})
procs.push(tauriProc)

tauriProc.on('exit', cleanup)
turboProc.on('exit', () => {})
