import { spawn } from 'node:child_process'
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { terminateProcessTree } from './dev-desktop.mjs'

const isRunning = (pid) => {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return error?.code === 'EPERM'
  }
}

const readPid = (stream) =>
  new Promise((resolvePid, rejectPid) => {
    let output = ''

    const onData = (chunk) => {
      output += chunk.toString()
      const newlineIndex = output.indexOf('\n')
      if (newlineIndex === -1) return

      stream.off('data', onData)
      const pid = Number(output.slice(0, newlineIndex))
      if (Number.isInteger(pid)) resolvePid(pid)
      else rejectPid(new Error(`Invalid child PID: ${output}`))
    }

    stream.on('data', onData)
    stream.once('error', rejectPid)
  })

test(
  'terminateProcessTree stops descendants in separate process groups',
  { timeout: 10_000 },
  async (t) => {
    const nestedProcessSource = `
    const { spawn } = require('node:child_process')
    const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
      detached: process.platform !== 'win32',
      stdio: 'ignore',
    })
    process.stdout.write(String(child.pid) + '\\n')
    setInterval(() => {}, 1000)
  `

    const rootProcess = spawn(process.execPath, ['-e', nestedProcessSource], {
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'inherit'],
    })
    const descendantPid = await readPid(rootProcess.stdout)

    t.after(() => {
      for (const pid of [descendantPid, rootProcess.pid]) {
        if (pid && isRunning(pid)) process.kill(pid, 'SIGKILL')
      }
    })

    assert.equal(isRunning(rootProcess.pid), true)
    assert.equal(isRunning(descendantPid), true)

    await terminateProcessTree(rootProcess.pid, { forceKillWaitMs: 1_000, gracePeriodMs: 250 })

    assert.equal(isRunning(rootProcess.pid), false)
    assert.equal(isRunning(descendantPid), false)
  },
)
