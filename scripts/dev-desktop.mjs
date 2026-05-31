import { execSync, spawn } from 'child_process'
import { promisify } from 'util'
import { exec } from 'child_process'

const execAsync = promisify(exec)

const procs = []

const killPort = async (port) => {
  const platform = process.platform
  try {
    if (platform === 'win32') {
      const { stdout } = await execAsync(`netstat -ano | findstr :${port}`)
      const lines = stdout.split('\n').filter((line) => line.trim())
      for (const line of lines) {
        const parts = line.trim().split(/\s+/)
        const pid = parts[parts.length - 1]
        if (pid && pid !== '0') {
          try {
            execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' })
          } catch {}
        }
      }
    } else {
      execSync(`lsof -ti :${port} | xargs kill -TERM 2>/dev/null || true`, { stdio: 'ignore' })
    }
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

await killPort(3000)
await killPort(3030)
await sleep(500)

const turboProc = spawn(
  'yarn',
  ['turbo', 'run', 'dev', '--filter=!@markflowy/desktop', '--filter=!@markflowy/web'],
  { stdio: 'inherit', shell: true },
)
procs.push(turboProc)

await sleep(8000)

const tauriProc = spawn('yarn', ['workspace', '@markflowy/desktop', 'tauri:dev'], {
  stdio: 'inherit',
  shell: true,
})
procs.push(tauriProc)

tauriProc.on('exit', cleanup)
turboProc.on('exit', () => {})
